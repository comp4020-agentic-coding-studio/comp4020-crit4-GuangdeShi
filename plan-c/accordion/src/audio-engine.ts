// Accordion-style Web Audio voice.
//
// Not a plain oscillator or organ pad: each note is a small bank of
// slightly-detuned reed oscillators sharing a hand-built harmonic
// spectrum (via createPeriodicWave), so two voices beat gently against
// each other the way real accordion reeds (musette tuning) do. The
// whole instrument runs through a shared "bellows" gain bus plus two
// filters that brighten/darken with bellows pressure and push/pull
// direction, standing in for reed-chamber body resonance.

const HARMONIC_AMPLITUDES = [1, 0.55, 0.38, 0.22, 0.14, 0.08, 0.05];
const DETUNE_CENTS = [-7, 0, 7];

// Attack tightens as bellows pressure rises -- a hard, fast push/pull
// makes a reed speak almost instantly, a gentle one takes a beat longer.
const NOTE_ATTACK_MAX_S = 0.09;
const NOTE_ATTACK_MIN_S = 0.015;
const NOTE_RELEASE_S = 0.12;
const VOICE_CLEANUP_DELAY_S = NOTE_RELEASE_S + 0.1;

const BELLOWS_SMOOTH_TIME_S = 0.03;
const SILENT_BELLOWS_FLOOR = 0.04;

// A thin layer of filtered air/reed noise, audible only while the bellows
// actually has pressure -- otherwise sustained notes read as too "clean"
// and electronic.
const NOISE_PEAK_GAIN = 0.025;

interface Voice {
  oscillators: OscillatorNode[];
  gain: GainNode;
  stopTimeout: ReturnType<typeof setTimeout> | null;
}

export class AccordionEngine {
  #ctx: AudioContext;
  #reedWave: PeriodicWave;
  #bellowsGain: GainNode;
  #brightnessFilter: BiquadFilterNode;
  #bodyFilter: BiquadFilterNode;
  #noiseGain: GainNode;
  #voices = new Map<string, Voice>();
  #currentPressure = 0;

  constructor() {
    this.#ctx = new AudioContext();
    this.#reedWave = this.#buildReedWave();

    this.#bellowsGain = this.#ctx.createGain();
    this.#bellowsGain.gain.value = 0;

    this.#brightnessFilter = this.#ctx.createBiquadFilter();
    this.#brightnessFilter.type = "peaking";
    this.#brightnessFilter.frequency.value = 1400;
    this.#brightnessFilter.Q.value = 0.8;
    this.#brightnessFilter.gain.value = 0;

    this.#bodyFilter = this.#ctx.createBiquadFilter();
    this.#bodyFilter.type = "lowpass";
    this.#bodyFilter.frequency.value = 5200;
    this.#bodyFilter.Q.value = 0.5;

    this.#bellowsGain.connect(this.#brightnessFilter);
    this.#brightnessFilter.connect(this.#bodyFilter);
    this.#bodyFilter.connect(this.#ctx.destination);

    this.#noiseGain = this.#ctx.createGain();
    this.#noiseGain.gain.value = 0;
    const noiseFilter = this.#ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 4200;
    noiseFilter.Q.value = 0.6;
    const noise = this.#ctx.createBufferSource();
    noise.buffer = this.#buildNoiseBuffer();
    noise.loop = true;
    noise.connect(noiseFilter);
    noiseFilter.connect(this.#noiseGain);
    this.#noiseGain.connect(this.#bellowsGain);
    noise.start();
  }

  /** Resumes the AudioContext; must be called from a user gesture (keydown). */
  async resume(): Promise<void> {
    if (this.#ctx.state === "suspended") await this.#ctx.resume();
  }

  /**
   * @param pressure 0..1 bellows pressure (see bellows.ts).
   * @param direction -1 (push) / 0 (rest) / 1 (pull) -- colours the tone subtly.
   */
  setBellows(pressure: number, direction: -1 | 0 | 1): void {
    this.#currentPressure = pressure;
    const now = this.#ctx.currentTime;
    // A silent bellows should still let a freshly-struck key speak a touch
    // (like a real reed getting a little residual air), rather than going
    // fully mute -- but a *stationary* screen must never sustain a note.
    const audibleGain = SILENT_BELLOWS_FLOOR + pressure * (1 - SILENT_BELLOWS_FLOOR);
    this.#bellowsGain.gain.setTargetAtTime(pressure > 0.001 ? audibleGain : 0, now, BELLOWS_SMOOTH_TIME_S);
    this.#noiseGain.gain.setTargetAtTime(pressure * NOISE_PEAK_GAIN, now, BELLOWS_SMOOTH_TIME_S);

    // Push brightens slightly, pull darkens slightly -- a small, physical-
    // feeling asymmetry rather than a dramatic effect.
    const brightnessTarget = direction * 3 * pressure;
    const bodyFreqTarget = 5200 + direction * 400 * pressure;
    this.#brightnessFilter.gain.setTargetAtTime(brightnessTarget, now, BELLOWS_SMOOTH_TIME_S);
    this.#bodyFilter.frequency.setTargetAtTime(bodyFreqTarget, now, BELLOWS_SMOOTH_TIME_S);
  }

  noteOn(id: string, frequency: number): void {
    const now = this.#ctx.currentTime;
    const attackS = Math.max(NOTE_ATTACK_MIN_S, NOTE_ATTACK_MAX_S - this.#currentPressure * (NOTE_ATTACK_MAX_S - NOTE_ATTACK_MIN_S));

    const releasing = this.#voices.get(id);
    if (releasing) {
      if (releasing.stopTimeout === null) return; // still fully held, ignore duplicate on
      // The same key was released and pressed again before its old voice's
      // cleanup timer fired -- retrigger it in place instead of silently
      // dropping the new note-on (this was the cause of keys "not sounding"
      // on quick repeat presses).
      clearTimeout(releasing.stopTimeout);
      releasing.stopTimeout = null;
      releasing.gain.gain.cancelScheduledValues(now);
      releasing.gain.gain.setValueAtTime(releasing.gain.gain.value, now);
      releasing.gain.gain.linearRampToValueAtTime(1, now + attackS);
      return;
    }

    const gain = this.#ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + attackS);
    gain.connect(this.#bellowsGain);

    const oscillators = DETUNE_CENTS.map((cents) => {
      const osc = this.#ctx.createOscillator();
      osc.setPeriodicWave(this.#reedWave);
      osc.frequency.value = frequency;
      osc.detune.value = cents;
      osc.connect(gain);
      osc.start(now);
      return osc;
    });

    this.#voices.set(id, { oscillators, gain, stopTimeout: null });
  }

  noteOff(id: string): void {
    const voice = this.#voices.get(id);
    if (!voice || voice.stopTimeout !== null) return; // already releasing

    const now = this.#ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + NOTE_RELEASE_S);

    voice.stopTimeout = setTimeout(() => {
      for (const osc of voice.oscillators) {
        osc.stop();
        osc.disconnect();
      }
      voice.gain.disconnect();
      this.#voices.delete(id);
    }, VOICE_CLEANUP_DELAY_S * 1000);
  }

  #buildNoiseBuffer(): AudioBuffer {
    const durationS = 2;
    const buffer = this.#ctx.createBuffer(1, this.#ctx.sampleRate * durationS, this.#ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  #buildReedWave(): PeriodicWave {
    const real = new Float32Array(HARMONIC_AMPLITUDES.length + 1);
    const imag = new Float32Array(HARMONIC_AMPLITUDES.length + 1);
    HARMONIC_AMPLITUDES.forEach((amplitude, index) => {
      imag[index + 1] = amplitude; // sine-phase harmonics: reedy, not a pure buzz
    });
    return this.#ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }
}
