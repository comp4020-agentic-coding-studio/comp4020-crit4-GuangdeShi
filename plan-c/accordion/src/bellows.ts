// Models the accordion's bellows as an AIR-PRESSURE source, not a sound
// source in its own right. On a real piano accordion the keys select which
// reed speaks; the bellows only supply (and shape) the airflow that makes
// the selected reed audible. This module's job is exactly that: turn lid
// angular velocity into a pressure/direction signal that the audio engine
// later uses to gate and shape reed loudness -- it has no opinion about
// pitch, and produces no sound by itself.
//
// The expressive signal is |velocity|, not absolute angle -- a still screen
// should mean silence regardless of how open it's sitting, exactly like a
// motionless bellows on a real instrument.
//
// Below the dead zone, pressure targets 0 (screen essentially still).
// Between the dead zone and the saturation point, pressure ramps linearly.
// Above saturation, pressure is clamped at 1 -- extra speed doesn't make it
// louder still.
//
// The instantaneous target is then smoothed with an asymmetric time
// constant: pressure rises quickly when movement begins (short attack) and
// leaks away more slowly when it stops (a short decay "tail" of residual
// air), rather than snapping to 0 the instant velocity crosses back under
// the dead zone.
//
// Finally, reversing bellows direction (pull -> push or vice versa) applies
// a brief, shallow pressure dip: a real accordion has a small articulation
// interruption at the moment the bellows changes direction, since airflow
// through the reed briefly stalls while the mechanism reverses.

const DEAD_ZONE_DEG_PER_S = 3;
// Normal, non-frantic lid movement speed should be able to reach full
// bellows pressure -- much higher and the instrument stays timid/quiet
// under everyday motion and only gets loud during unrealistically fast flicks.
const SATURATE_DEG_PER_S = 40;
const ATTACK_TIME_CONSTANT_S = 0.05;
// Decay tail so a stopped bellows fades out more like a real instrument's
// residual air than a quick digital cutoff.
const DECAY_TIME_CONSTANT_S = 0.4;

// Direction-reversal articulation: a brief, shallow dip in effective
// pressure, not a full mute -- real bellows reversal is a small hiccup, not
// a rest.
const DIRECTION_CHANGE_DIP_STRENGTH = 0.45;
const DIP_RECOVERY_TIME_CONSTANT_S = 0.09;

export type BellowsDirection = -1 | 0 | 1;

export interface BellowsState {
  /** 0..1 effective air pressure, already including the direction-change dip. */
  pressure: number;
  /** 1 = opening/PULL, -1 = closing/PUSH, 0 = at rest (no residual pressure). */
  direction: BellowsDirection;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export class BellowsPressure {
  #rawPressure = 0;
  #direction: BellowsDirection = 0;
  #dip = 0;
  #lastUpdateMs: number | null = null;

  /** @param velocity degrees/second, signed. @param nowMs performance.now()-style timestamp, ms. */
  update(velocity: number, nowMs: number): BellowsState {
    const absVelocity = Math.abs(velocity);
    const target =
      absVelocity < DEAD_ZONE_DEG_PER_S
        ? 0
        : clamp01((absVelocity - DEAD_ZONE_DEG_PER_S) / (SATURATE_DEG_PER_S - DEAD_ZONE_DEG_PER_S));

    const dtSeconds = this.#lastUpdateMs === null ? 0 : Math.max(0, (nowMs - this.#lastUpdateMs) / 1000);
    this.#lastUpdateMs = nowMs;

    const timeConstant = target > this.#rawPressure ? ATTACK_TIME_CONSTANT_S : DECAY_TIME_CONSTANT_S;
    const smoothing = dtSeconds === 0 ? 1 : 1 - Math.exp(-dtSeconds / timeConstant);
    this.#rawPressure += (target - this.#rawPressure) * smoothing;

    const nextDirection: BellowsDirection = absVelocity >= DEAD_ZONE_DEG_PER_S ? (velocity > 0 ? 1 : -1) : this.#direction;
    if (this.#direction !== 0 && nextDirection !== 0 && nextDirection !== this.#direction) {
      this.#dip = 1; // bellows just reversed -- trigger the articulation dip
    }
    this.#direction = nextDirection;

    const dipSmoothing = dtSeconds === 0 ? 0 : 1 - Math.exp(-dtSeconds / DIP_RECOVERY_TIME_CONSTANT_S);
    this.#dip -= this.#dip * dipSmoothing;

    const effectivePressure = this.#rawPressure * (1 - DIRECTION_CHANGE_DIP_STRENGTH * this.#dip);

    return {
      pressure: effectivePressure,
      // Keep the last real direction while residual pressure is still
      // leaking out, so the push/pull tone colour doesn't snap to neutral
      // the instant the screen stops -- it fades out with the air.
      direction: this.#rawPressure > 0.001 ? this.#direction : 0,
    };
  }
}
