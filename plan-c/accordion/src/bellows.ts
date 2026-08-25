// Maps lid angular velocity into a bellows "air pressure" signal (0..1).
// The expressive signal is |velocity|, not absolute angle -- a still
// screen should mean silence regardless of how open it's sitting.
//
// Below the dead zone, pressure targets 0 (screen essentially still).
// Between the dead zone and the saturation point, pressure ramps
// linearly. Above saturation, pressure is clamped at 1 -- extra speed
// doesn't make it louder still.
//
// The instantaneous target is then smoothed with an asymmetric time
// constant: pressure rises quickly when movement begins (short attack)
// and leaks away more slowly when it stops (a short decay "tail" of
// residual air), rather than snapping to 0 the instant velocity crosses
// back under the dead zone.

const DEAD_ZONE_DEG_PER_S = 3;
// Lowered from 55: normal, non-frantic lid movement speed should be able to
// reach full bellows pressure -- at 55 the instrument stayed timid/quiet
// under everyday motion and only got loud during unrealistically fast flicks.
const SATURATE_DEG_PER_S = 40;
const ATTACK_TIME_CONSTANT_S = 0.05;
// Slightly longer decay tail so a stopped bellows fades out more like a real
// instrument's residual air than a quick digital cutoff.
const DECAY_TIME_CONSTANT_S = 0.4;

export type BellowsDirection = -1 | 0 | 1;

export interface BellowsState {
  pressure: number;
  /** 1 = opening/PULL, -1 = closing/PUSH, 0 = at rest (no residual pressure). */
  direction: BellowsDirection;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export class BellowsModel {
  #pressure = 0;
  #direction: BellowsDirection = 0;
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

    const timeConstant = target > this.#pressure ? ATTACK_TIME_CONSTANT_S : DECAY_TIME_CONSTANT_S;
    const smoothing = dtSeconds === 0 ? 1 : 1 - Math.exp(-dtSeconds / timeConstant);
    this.#pressure += (target - this.#pressure) * smoothing;

    if (absVelocity >= DEAD_ZONE_DEG_PER_S) {
      this.#direction = velocity > 0 ? 1 : -1;
    }

    return {
      pressure: this.#pressure,
      // Keep the last real direction while residual pressure is still
      // leaking out, so the push/pull tone colour doesn't snap to
      // neutral the instant the screen stops -- it fades out with the air.
      direction: this.#pressure > 0.001 ? this.#direction : 0,
    };
  }
}
