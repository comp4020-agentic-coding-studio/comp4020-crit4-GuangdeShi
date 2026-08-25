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

const NOTE_ATTACK_S = 0.02;
const NOTE_RELEASE_S = 0.12;
const VOICE_CLEANUP_DELAY_S = NOTE_RELEASE_S + 0.1;

const BELLOWS_SMOOTH_TIME_S = 0.03;
const SILENT_BELLOWS_FLOOR = 0.04;

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
  #voices = new Map<string, Voice>();

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
    const now = this.#ctx.currentTime;
    // A silent bellows should still let a freshly-struck key speak a touch
    // (like a real reed getting a little residual air), rather than going
    // fully mute -- but a *stationary* screen must never sustain a note.
    const audibleGain = SILENT_BELLOWS_FLOOR + pressure * (1 - SILENT_BELLOWS_FLOOR);
    this.#bellowsGain.gain.setTargetAtTime(pressure > 0.001 ? audibleGain : 0, now, BELLOWS_SMOOTH_TIME_S);

    // Push brightens slightly, pull darkens slightly -- a small, physical-
    // feeling asymmetry rather than a dramatic effect.
    const brightnessTarget = direction * 3 * pressure;
    const bodyFreqTarget = 5200 + direction * 400 * pressure;
    this.#brightnessFilter.gain.setTargetAtTime(brightnessTarget, now, BELLOWS_SMOOTH_TIME_S);
    this.#bodyFilter.frequency.setTargetAtTime(bodyFreqTarget, now, BELLOWS_SMOOTH_TIME_S);
  }

  noteOn(id: string, frequency: number): void {
    if (this.#voices.has(id)) return; // ignore duplicate on (e.g. OS key auto-repeat)

    const now = this.#ctx.currentTime;
    const gain = this.#ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + NOTE_ATTACK_S);
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

  #buildReedWave(): PeriodicWave {
    const real = new Float32Array(HARMONIC_AMPLITUDES.length + 1);
    const imag = new Float32Array(HARMONIC_AMPLITUDES.length + 1);
    HARMONIC_AMPLITUDES.forEach((amplitude, index) => {
      imag[index + 1] = amplitude; // sine-phase harmonics: reedy, not a pure buzz
    });
    return this.#ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }
}
