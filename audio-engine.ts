// Piano-accordion instrument model.
//
// Interaction model (revised): a key produces a base reed tone the instant
// it's pressed -- pressing a key with a completely still bellows must still
// be clearly audible, at a comfortable "mp" baseline. Bellows motion is an
// EXPRESSIVE MODULATION on top of that baseline, not a gate: it pushes
// loudness/brightness up toward "ff" and adds a small, restrained pitch
// bend, but it never has to be moving for a held key to speak, and letting
// it settle back to rest returns a held note to its baseline instead of
// silence.
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
// There is still no standalone "bellows noise": moving the screen with no
// key held stays silent, because there's no open valve for that shared air
// bus to feed -- the change is only that an *open* valve no longer needs
// moving air to be heard.

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
// Widened from an earlier 0.09 max so a soft attack is clearly gentler, not
// just barely slower than a fast one.
const NOTE_ATTACK_MAX_S = 0.11;
const NOTE_ATTACK_MIN_S = 0.015;
const NOTE_RELEASE_S = 0.12;
const VOICE_CLEANUP_DELAY_S = NOTE_RELEASE_S + 0.1;

// Real accordion reeds: lower/heavier reeds need somewhat more air to
// speak fully than high ones. Modelled as a small attack-time penalty
// below middle C, capped low so no key ever reads as broken or delayed.
const LOW_NOTE_REFERENCE_FREQUENCY_HZ = 261.63; // C4
const LOW_NOTE_MAX_ATTACK_SCALE = 1.3;

const AIR_BUS_SMOOTH_TIME_S = 0.03;
// A held key must speak on its own at a comfortable, clearly-audible "mp"
// level with the bellows completely at rest -- this is the floor the old
// "silent unless moving" gate used to enforce, now repurposed as the
// baseline every note starts from. Bellows pressure then scales *up* from
// here toward 1 at full pressure, so the pp..ff swing survives as "baseline
// -> louder/brighter," not "silence -> present."
const AIR_BUS_BASELINE_GAIN = 0.55;

// Small, restrained bellows-driven pitch expression (Section 3): PULL bends
// a touch sharp, PUSH a touch flat, scaled by pressure so a bare dead-zone
// crossing barely nudges it and full-speed motion reaches the edge of the
// range. Deliberately asymmetric and both sides small enough that the note
// never reads as a different pitch -- only as "alive."
const PITCH_BEND_PULL_CENTS_MAX = 15;
const PITCH_BEND_PUSH_CENTS_MAX = -10;
const PITCH_BEND_SMOOTH_TIME_S = 0.04;

// Pressure-driven brightness: independent of push/pull direction, a harder
// bellows push should sound brighter/richer, not just louder -- real
// accordion dynamics aren't "same tone, more volume." These stack with the
// smaller direction-coloured shift below.
const PRESSURE_BRIGHTNESS_GAIN_DB_RANGE = 9;
const PRESSURE_BODY_FREQUENCY_HZ_RANGE = 3200;
const BODY_FREQUENCY_AT_REST_HZ = 4800;
// Direction still colours the tone slightly (push brighter, pull darker)
// on top of the pressure-driven brightening above, kept smaller so it reads
// as character, not the main effect.
const DIRECTIONAL_BRIGHTNESS_GAIN_DB_RANGE = 4;
const DIRECTIONAL_BODY_FREQUENCY_HZ_RANGE = 500;

// Bus makeup gain applied after the compressor -- the compressor keeps
// several open reeds (main + sub-octave, possibly a full chord) from
// clipping, this brings the overall level back up to something that
// actually reads as "present" rather than thin.
const MASTER_GAIN = 1;

// Final safety stage, placed after MASTER_GAIN, right before the
// destination. The bus compressor above is deliberately gentle (ratio 2)
// so the widened pp-ff bellows dynamic survives, and does help with
// sustained loudness -- but three detuned oscillators plus a sub-reed
// summing per note, times a multi-note chord, can align to sample-level
// peaks well over unity even at an ordinary single note's medium
// pressure (measured up to ~1.4x with a 6-note chord at full pressure).
// A DynamicsCompressorNode's ballistics can't react to peaks that fast,
// so a deterministic WaveShaperNode soft-clip follows it as the actual
// guarantee against overs: identity (no change at all) below
// SOFT_CLIP_KNEE, smoothly saturating toward ~1 above it, so ordinary
// playing is untouched and only genuine sample peaks get caught --
// without the harsh, brittle-sounding corner a hard clip would add.
const LIMITER_THRESHOLD_DB = 0;
const LIMITER_RATIO = 20;
const SOFT_CLIP_KNEE = 0.85;

/**
 * Builds a soft-clip curve for the final safety WaveShaper: the identity
 * function below SOFT_CLIP_KNEE, smoothly saturating toward (but never
 * reaching) 1 above it, mirrored for negative values. Anything the
 * WaveShaper receives beyond +-1 clamps to this curve's edge value, so the
 * output magnitude is bounded regardless of how far a transient overshoots.
 */
function buildSoftClipCurve(): Float32Array {
  const SAMPLES = 1024;
  const curve = new Float32Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i / (SAMPLES - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= SOFT_CLIP_KNEE ? ax : SOFT_CLIP_KNEE + (1 - SOFT_CLIP_KNEE) * Math.tanh((ax - SOFT_CLIP_KNEE) / (1 - SOFT_CLIP_KNEE));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

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
  // Each oscillator keeps its own fixed musette detune alongside the node,
  // so a live pitch-bend update (setPitchBend) can recompute
  // `baseDetuneCents + bendCents` without losing the original tuning.
  #oscillators: { node: OscillatorNode; baseDetuneCents: number }[] = [];
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
      this.#oscillators.push({ node: osc, baseDetuneCents: cents });
    }

    const subGain = ctx.createGain();
    subGain.gain.value = SUB_OCTAVE_GAIN;
    subGain.connect(this.#gain);
    const subOsc = ctx.createOscillator();
    subOsc.setPeriodicWave(reedBank.sixteenFootWave);
    subOsc.frequency.value = frequency * Math.pow(2, SUB_OCTAVE_SEMITONES / 12);
    subOsc.connect(subGain);
    subOsc.start(now);
    this.#oscillators.push({ node: subOsc, baseDetuneCents: 0 });
  }

  /**
   * Nudges every oscillator's detune by `bendCents` on top of its own fixed
   * musette tuning (Section 3) -- a small, live pitch expression driven by
   * bellows direction/speed. Smoothed rather than snapped so direction
   * reversals don't click.
   */
  setPitchBend(bendCents: number, now: number): void {
    for (const { node, baseDetuneCents } of this.#oscillators) {
      node.detune.setTargetAtTime(baseDetuneCents + bendCents, now, PITCH_BEND_SMOOTH_TIME_S);
    }
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
      for (const { node } of this.#oscillators) {
        node.stop();
        node.disconnect();
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
  #limiter: DynamicsCompressorNode;
  #softClip: WaveShaperNode;
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
    this.#brightnessFilter.gain.value = 0; // resting/soft baseline is deliberately duller -- see setBellows

    this.#bodyFilter = this.#ctx.createBiquadFilter();
    this.#bodyFilter.type = "lowpass";
    this.#bodyFilter.frequency.value = BODY_FREQUENCY_AT_REST_HZ;
    this.#bodyFilter.Q.value = 0.5;

    // Gentle bus glue: keeps several open reeds (a full chord, plus each
    // note's own sub-octave reed) from clipping, so MASTER_GAIN can push
    // the overall level up without harsh distortion. Threshold raised and
    // ratio eased back further from an earlier, squashier setting -- the
    // whole point of this pass is a wide, obvious bellows dynamic, and a
    // compressor that engages too early flattens exactly that difference
    // back out. This only meaningfully engages on genuinely loud moments
    // (a full-pressure chord), not on ordinary single-note dynamics.
    this.#compressor = this.#ctx.createDynamicsCompressor();
    this.#compressor.threshold.value = -4;
    this.#compressor.knee.value = 8;
    this.#compressor.ratio.value = 2;
    this.#compressor.attack.value = 0.003;
    this.#compressor.release.value = 0.2;

    this.#masterGain = this.#ctx.createGain();
    this.#masterGain.gain.value = MASTER_GAIN;

    this.#limiter = this.#ctx.createDynamicsCompressor();
    this.#limiter.threshold.value = LIMITER_THRESHOLD_DB;
    this.#limiter.knee.value = 0;
    this.#limiter.ratio.value = LIMITER_RATIO;
    this.#limiter.attack.value = 0.001;
    this.#limiter.release.value = 0.1;

    this.#softClip = this.#ctx.createWaveShaper();
    this.#softClip.curve = buildSoftClipCurve() as Float32Array<ArrayBuffer>;
    this.#softClip.oversample = "4x"; // reduces aliasing from the nonlinearity into harsh digital buzzing

    this.#airBus.connect(this.#brightnessFilter);
    this.#brightnessFilter.connect(this.#bodyFilter);
    this.#bodyFilter.connect(this.#compressor);
    this.#compressor.connect(this.#masterGain);
    this.#masterGain.connect(this.#limiter);
    this.#limiter.connect(this.#softClip);
    this.#softClip.connect(this.#ctx.destination);
  }

  /**
   * Resumes the AudioContext and only returns once it's actually running.
   * Must be called from a user gesture (keydown/pointerdown), and callers
   * must await it before triggering a note -- on Safari in particular,
   * `resume()` can still be settling when the very next line runs, so a
   * fire-and-forget `void engine.resume()` followed immediately by
   * `noteOn()` can race a context that hasn't unlocked yet and drop the
   * first note. `state !== "running"` (rather than just "suspended") also
   * covers Safari's "interrupted" state.
   */
  async resume(): Promise<void> {
    if (this.#ctx.state !== "running") await this.#ctx.resume();
  }

  /**
   * Bellows state never changes which pitch is playing (Section 13) -- it
   * shapes how expressive an already-sounding key's baseline tone is:
   * louder, brighter, and with a small directional pitch bend, scaling up
   * from the "mp" baseline in AIR_BUS_BASELINE_GAIN rather than up from
   * silence. `pressure` and `direction` come from BellowsPressure in
   * bellows.ts, which derives them from lid angular velocity (or the drag
   * fallback's synthetic velocity).
   * @param pressure 0..1 bellows pressure.
   * @param direction -1 (push) / 0 (rest) / 1 (pull) -- colours the tone subtly.
   */
  setBellows(pressure: number, direction: -1 | 0 | 1): void {
    this.#currentPressure = pressure;
    const now = this.#ctx.currentTime;
    // Baseline "mp" level with the bellows fully at rest, scaling up toward
    // 1 (full "ff") as pressure rises -- an open valve is always audible
    // here; there's no pressure threshold that drops it to silence.
    const audibleGain = AIR_BUS_BASELINE_GAIN + pressure * (1 - AIR_BUS_BASELINE_GAIN);
    this.#airBus.gain.setTargetAtTime(audibleGain, now, AIR_BUS_SMOOTH_TIME_S);

    // Timbre changes with bellows pressure, not just loudness -- soft
    // bellows should sound darker/smoother, hard bellows brighter/more
    // reedy, the same way a real accordion's forte isn't just "the same
    // tone turned up." This is the main, direction-symmetric driver; push
    // vs. pull then adds a smaller directional tilt on top, so the two
    // effects are perceptibly different in scale, not just in sign.
    const brightnessTarget = pressure * PRESSURE_BRIGHTNESS_GAIN_DB_RANGE + direction * DIRECTIONAL_BRIGHTNESS_GAIN_DB_RANGE * pressure;
    const bodyFreqTarget =
      BODY_FREQUENCY_AT_REST_HZ + pressure * PRESSURE_BODY_FREQUENCY_HZ_RANGE + direction * DIRECTIONAL_BODY_FREQUENCY_HZ_RANGE * pressure;
    this.#brightnessFilter.gain.setTargetAtTime(brightnessTarget, now, AIR_BUS_SMOOTH_TIME_S);
    this.#bodyFilter.frequency.setTargetAtTime(bodyFreqTarget, now, AIR_BUS_SMOOTH_TIME_S);

    // Subtle pitch expression (Section 3): pull bends a touch sharp, push a
    // touch flat, scaled by pressure so it's barely there at low pressure
    // and reaches its small max at full speed. Applied to every currently
    // open-or-releasing valve so a held chord bends together.
    const bendCentsMax = direction === 1 ? PITCH_BEND_PULL_CENTS_MAX : direction === -1 ? PITCH_BEND_PUSH_CENTS_MAX : 0;
    const bendCents = bendCentsMax * pressure;
    for (const valve of this.#valves.values()) valve.setPitchBend(bendCents, now);
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
