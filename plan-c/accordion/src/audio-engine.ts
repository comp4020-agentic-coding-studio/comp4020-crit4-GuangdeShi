// Piano-accordion instrument model.
//
// The physical instrument this imitates works like this: the KEYBOARD
// selects which reed/pitch is allowed to sound (a "valve" opening onto that
// reed), and the BELLOWS supply the airflow that makes an open valve
// audible -- airflow controls loudness/expression, never pitch. Holding a
// key with a still bellows should be close to silent; the same key stays
// exactly the same pitch whether the bellows are pushing or pulling.
//
// That maps onto three pieces here:
//   - ReedBank    the fixed harmonic "instrument" -- the waveforms shared by
//                 every note, standing in for a real reed's fixed timbre.
//   - NoteValve   one held key's oscillator bank + envelope. Exists only
//                 while that key is down (plus a short release tail).
//   - AccordionEngine
//                 wires open valves into a single shared air bus so every
//                 sounding note rises and falls together with one bellows
//                 pressure, the way a real accordion's air chamber feeds
//                 every open reed at once (Section 15: bellows is a GLOBAL
//                 expression source, not per-note).
//
// There is deliberately no standalone "bellows noise" here: moving the
// screen with no key held must be silent, because on a real accordion
// airflow with no open reed makes no note either.

// Harmonic content of the main 8' reed rank: strong fundamental with
// carefully *unequal* partials, not a flat/equal spectrum (that reads as a
// buzzy synth, not a reed). A real free reed doesn't just decay smoothly
// from the fundamental -- its odd partials (3rd, 5th) sit relatively strong
// against their even neighbours, which is what gives it that nasal, slightly
// "buzzy-but-warm" penetrating quality instead of a rounder, organ-like
// decay. The 3rd here is pulled back up close to the 2nd, and a 7th partial
// is added, for exactly that.
const REED_HARMONIC_AMPLITUDES = [1, 0.55, 0.5, 0.22, 0.2, 0.1, 0.11, 0.05];
// The optional lower (16') register is deliberately softer/rounder -- a
// real sub-octave rank reinforces body without dominating the main reed.
const SUB_REED_HARMONIC_AMPLITUDES = [1, 0.3, 0.11];
const REED_PEAK = 0.9;
const SUB_REED_PEAK = 0.9;

// Two 8' reeds tuned a few cents apart (plus the centre) beat gently
// against each other -- the classic accordion "musette" character. Kept
// narrow deliberately: wider and it reads as a supersaw synth, not two
// reeds of the same rank.
const DETUNE_CENTS = [-7, 0, 7];
const SUB_OCTAVE_SEMITONES = -12;
const SUB_OCTAVE_GAIN = 0.4;

// Attack tightens as bellows pressure rises -- a hard, fast bellows push
// makes a reed speak almost instantly, a gentle one takes a beat longer.
const NOTE_ATTACK_MAX_S = 0.09;
const NOTE_ATTACK_MIN_S = 0.015;
const NOTE_RELEASE_S = 0.12;
const VOICE_CLEANUP_DELAY_S = NOTE_RELEASE_S + 0.1;

// Real accordion reeds: lower/heavier reeds need somewhat more air to
// speak fully than high ones. Modelled as a small attack-time penalty
// below middle C, capped low so no key ever reads as broken or delayed.
const LOW_NOTE_REFERENCE_FREQUENCY_HZ = 261.63; // C4
const LOW_NOTE_MAX_ATTACK_SCALE = 1.3;

const AIR_BUS_SMOOTH_TIME_S = 0.03;
// A held note should still speak *faintly* the instant bellows pressure
// crosses the dead zone (like a real reed catching residual air), but a
// motionless bellows must stay silent -- see the pressure>0 gate below.
// Pulled down from an earlier 0.07: a real accordion's pp is much quieter
// relative to its ff than that, and the wider that gap, the more a slow
// vs. fast bellows pump actually reads as a volume *swell* rather than an
// on/off switch.
const AIR_BUS_MIN_GAIN_WHEN_MOVING = 0.045;

// Bus makeup gain applied after the compressor -- the compressor keeps
// several open reeds (main + sub-octave, possibly a full chord) from
// clipping, this brings the overall level back up to something that
// actually reads as "present" rather than thin.
const MASTER_GAIN = 1.9;

/** How much slower (as a multiplier >= 1) a reed at this pitch should be to speak, per Section 14. */
function lowNoteAttackScale(frequencyHz: number): number {
  const ratio = LOW_NOTE_REFERENCE_FREQUENCY_HZ / frequencyHz;
  return Math.min(LOW_NOTE_MAX_ATTACK_SCALE, Math.max(1, ratio));
}

/** The instrument's fixed timbre: the harmonic waveforms shared by every note. */
class ReedBank {
  readonly eightFootWave: PeriodicWave;
  readonly sixteenFootWave: PeriodicWave;

  constructor(ctx: AudioContext) {
    this.eightFootWave = ReedBank.#buildWave(ctx, REED_HARMONIC_AMPLITUDES, REED_PEAK);
    this.sixteenFootWave = ReedBank.#buildWave(ctx, SUB_REED_HARMONIC_AMPLITUDES, SUB_REED_PEAK);
  }

  /**
   * Builds a harmonic PeriodicWave with a manually controlled peak, rather
   * than letting createPeriodicWave's own normalization pick an
   * unpredictable scale. `sum(|amplitude|)` is a safe upper bound on the
   * resulting waveform's peak, so scaling by it keeps the final peak at
   * `targetPeak` regardless of how many harmonics are mixed in.
   */
  static #buildWave(ctx: AudioContext, amplitudes: number[], targetPeak: number): PeriodicWave {
    const sum = amplitudes.reduce((total, amplitude) => total + amplitude, 0);
    const scale = targetPeak / sum;
    const real = new Float32Array(amplitudes.length + 1);
    const imag = new Float32Array(amplitudes.length + 1);
    amplitudes.forEach((amplitude, index) => {
      imag[index + 1] = amplitude * scale;
    });
    return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  }
}

/**
 * One held key's reed voice: the 8' musette bank (three slightly detuned
 * oscillators) plus a softer 16' sub-octave reed, sharing a single
 * per-note envelope gain. A NoteValve exists only while its key is open
 * (down) plus a short release tail -- it is the "valve" that lets airflow
 * from the shared air bus reach this particular pitch.
 */
class NoteValve {
  #ctx: AudioContext;
  #oscillators: OscillatorNode[] = [];
  #gain: GainNode;
  #stopTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: AudioContext, reedBank: ReedBank, destination: AudioNode, frequency: number, attackS: number) {
    this.#ctx = ctx;
    const now = ctx.currentTime;

    this.#gain = ctx.createGain();
    this.#gain.gain.setValueAtTime(0, now);
    this.#gain.gain.linearRampToValueAtTime(1, now + attackS);
    this.#gain.connect(destination);

    for (const cents of DETUNE_CENTS) {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(reedBank.eightFootWave);
      osc.frequency.value = frequency;
      osc.detune.value = cents;
      osc.connect(this.#gain);
      osc.start(now);
      this.#oscillators.push(osc);
    }

    const subGain = ctx.createGain();
    subGain.gain.value = SUB_OCTAVE_GAIN;
    subGain.connect(this.#gain);
    const subOsc = ctx.createOscillator();
    subOsc.setPeriodicWave(reedBank.sixteenFootWave);
    subOsc.frequency.value = frequency * Math.pow(2, SUB_OCTAVE_SEMITONES / 12);
    subOsc.connect(subGain);
    subOsc.start(now);
    this.#oscillators.push(subOsc);
  }

  /** True while this valve is fully open (key still held, not mid-release). */
  get isOpen(): boolean {
    return this.#stopTimeout === null;
  }

  /** Re-opens a valve that was mid-release, reusing its existing oscillators instead of dropping the note. */
  reopen(attackS: number): void {
    if (this.#stopTimeout === null) return;
    clearTimeout(this.#stopTimeout);
    this.#stopTimeout = null;
    const now = this.#ctx.currentTime;
    this.#gain.gain.cancelScheduledValues(now);
    this.#gain.gain.setValueAtTime(this.#gain.gain.value, now);
    this.#gain.gain.linearRampToValueAtTime(1, now + attackS);
  }

  /** Begins closing the valve (key released); schedules final cleanup after the release tail. */
  close(onFinished: () => void): void {
    if (this.#stopTimeout !== null) return; // already closing
    const now = this.#ctx.currentTime;
    this.#gain.gain.cancelScheduledValues(now);
    this.#gain.gain.setValueAtTime(this.#gain.gain.value, now);
    this.#gain.gain.linearRampToValueAtTime(0, now + NOTE_RELEASE_S);
    this.#stopTimeout = setTimeout(() => {
      for (const osc of this.#oscillators) {
        osc.stop();
        osc.disconnect();
      }
      this.#gain.disconnect();
      onFinished();
    }, VOICE_CLEANUP_DELAY_S * 1000);
  }
}

export class AccordionEngine {
  #ctx: AudioContext;
  #reedBank: ReedBank;
  // The shared "air bus": every open NoteValve feeds into this single gain
  // node, which the bellows pressure drives directly. This is what makes
  // polyphony behave like a real accordion (Section 15) -- one bellows
  // pressure raises/lowers every currently-sounding reed together, rather
  // than each note having its own independent dynamics.
  #airBus: GainNode;
  #brightnessFilter: BiquadFilterNode;
  #bodyFilter: BiquadFilterNode;
  #compressor: DynamicsCompressorNode;
  #masterGain: GainNode;
  #valves = new Map<string, NoteValve>();
  #currentPressure = 0;

  constructor() {
    this.#ctx = new AudioContext();
    this.#reedBank = new ReedBank(this.#ctx);

    this.#airBus = this.#ctx.createGain();
    this.#airBus.gain.value = 0;

    this.#brightnessFilter = this.#ctx.createBiquadFilter();
    this.#brightnessFilter.type = "peaking";
    this.#brightnessFilter.frequency.value = 1400;
    this.#brightnessFilter.Q.value = 0.8;
    this.#brightnessFilter.gain.value = 2; // a touch brighter/present at all times, not just under motion

    this.#bodyFilter = this.#ctx.createBiquadFilter();
    this.#bodyFilter.type = "lowpass";
    this.#bodyFilter.frequency.value = 6000;
    this.#bodyFilter.Q.value = 0.5;

    // Gentle bus glue: keeps several open reeds (a full chord, plus each
    // note's own sub-octave reed) from clipping, so MASTER_GAIN can push
    // the overall level up without harsh distortion. Threshold raised and
    // ratio eased back from an earlier, squashier setting -- a real
    // accordion's forte still has real dynamic bite to it; over-compressing
    // the bus flattened a hard bellows push into barely more than a soft one.
    this.#compressor = this.#ctx.createDynamicsCompressor();
    this.#compressor.threshold.value = -14;
    this.#compressor.knee.value = 6;
    this.#compressor.ratio.value = 2.8;
    this.#compressor.attack.value = 0.003;
    this.#compressor.release.value = 0.2;

    this.#masterGain = this.#ctx.createGain();
    this.#masterGain.gain.value = MASTER_GAIN;

    this.#airBus.connect(this.#brightnessFilter);
    this.#brightnessFilter.connect(this.#bodyFilter);
    this.#bodyFilter.connect(this.#compressor);
    this.#compressor.connect(this.#masterGain);
    this.#masterGain.connect(this.#ctx.destination);
  }

  /** Resumes the AudioContext; must be called from a user gesture (keydown). */
  async resume(): Promise<void> {
    if (this.#ctx.state === "suspended") await this.#ctx.resume();
  }

  /**
   * Bellows state only ever changes loudness/expression here -- never
   * pitch (Section 13). `pressure` and `direction` come from BellowsPressure
   * in bellows.ts, which derives them from lid angular velocity.
   * @param pressure 0..1 bellows pressure.
   * @param direction -1 (push) / 0 (rest) / 1 (pull) -- colours the tone subtly.
   */
  setBellows(pressure: number, direction: -1 | 0 | 1): void {
    this.#currentPressure = pressure;
    const now = this.#ctx.currentTime;
    // A silent, motionless bellows must mean silence, full stop -- there is
    // no "idle hum" here, unlike a note freshly struck under real pressure.
    const audibleGain = AIR_BUS_MIN_GAIN_WHEN_MOVING + pressure * (1 - AIR_BUS_MIN_GAIN_WHEN_MOVING);
    this.#airBus.gain.setTargetAtTime(pressure > 0.001 ? audibleGain : 0, now, AIR_BUS_SMOOTH_TIME_S);

    // Push brightens, pull darkens -- a subtle timbral shift, never a pitch
    // shift, so push/pull colour is perceptible without the note wandering.
    const brightnessTarget = 2 + direction * 6 * pressure;
    const bodyFreqTarget = 6000 + direction * 700 * pressure;
    this.#brightnessFilter.gain.setTargetAtTime(brightnessTarget, now, AIR_BUS_SMOOTH_TIME_S);
    this.#bodyFilter.frequency.setTargetAtTime(bodyFreqTarget, now, AIR_BUS_SMOOTH_TIME_S);
  }

  /** Opens the valve for `id`/`frequency` (key down). Retriggers in place if the same key was still releasing. */
  noteOn(id: string, frequency: number): void {
    const baseAttackS = Math.max(NOTE_ATTACK_MIN_S, NOTE_ATTACK_MAX_S - this.#currentPressure * (NOTE_ATTACK_MAX_S - NOTE_ATTACK_MIN_S));
    const attackS = baseAttackS * lowNoteAttackScale(frequency);

    const existing = this.#valves.get(id);
    if (existing) {
      if (existing.isOpen) return; // key already held, ignore duplicate/auto-repeat note-on
      // The same key was released and pressed again before its old valve's
      // cleanup timer fired -- reopen it in place instead of silently
      // dropping the new note-on (this was the cause of keys "not sounding"
      // on quick repeat presses).
      existing.reopen(attackS);
      return;
    }

    const valve = new NoteValve(this.#ctx, this.#reedBank, this.#airBus, frequency, attackS);
    this.#valves.set(id, valve);
  }

  /** Closes the valve for `id` (key up); the reed fades out over its release tail rather than cutting instantly. */
  noteOff(id: string): void {
    const valve = this.#valves.get(id);
    if (!valve || !valve.isOpen) return; // no such note, or already releasing
    valve.close(() => this.#valves.delete(id));
  }
}
