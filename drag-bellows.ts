// Pure logic for the browser-fallback bellows input: turns pointer-drag
// samples (a y position + timestamp, however they arrive) into the same
// signed velocity signal the physical lid sensor produces, so both feed the
// identical BellowsPressure model in bellows.ts -- there is no second
// pressure/audio path here, only a second *source* of velocity. No DOM or
// PointerEvent API appears in this file at all (that's wired in main.ts),
// the same reason bellows.ts itself has no AudioContext dependency: the
// drag-to-velocity math can be verified directly instead of only by hand.
//
// Sign convention matches the physical lid: dragging the bellows UP
// (extending it, like a lid opening further) is a positive/PULL velocity;
// dragging DOWN (compressing it) is negative/PUSH -- the same sign
// BellowsPressure already treats as direction.
import { BELLOWS_MAX_PX, BELLOWS_MIN_PX } from "./visuals.ts";

// Scales pixel drag speed onto the same numeric range BellowsPressure
// already tunes for real lid angular velocity in deg/s (dead zone 3,
// saturate 50 -- see bellows.ts). Chosen so a comfortable, quick drag
// (~420px/s) reaches full pressure and a slow, deliberate one clears the
// dead zone at ~25px/s, without a second tuning pass through bellows.ts.
const PX_PER_S_TO_DEG_PER_S = 50 / 420;

// A paused-but-not-released drag (no move sample for this long) reads as
// zero velocity, not whatever speed the last sample happened to have --
// exactly like a physical lid that's stopped moving but not yet let go.
const STILL_TIMEOUT_MS = 90;

export class DragBellows {
  #dragging = false;
  #extentPx = (BELLOWS_MIN_PX + BELLOWS_MAX_PX) / 2;
  #velocityDegPerS = 0;
  #lastSampleMs = 0;
  #lastY = 0;

  get extentPx(): number {
    return this.#extentPx;
  }

  get isDragging(): boolean {
    return this.#dragging;
  }

  start(y: number, nowMs: number): void {
    this.#dragging = true;
    this.#lastY = y;
    this.#lastSampleMs = nowMs;
    this.#velocityDegPerS = 0;
  }

  /** @returns the updated extent in px, for the caller to hand straight to AccordionVisuals.setExtentPx. */
  move(y: number, nowMs: number): number {
    if (!this.#dragging) return this.#extentPx;
    const dtMs = nowMs - this.#lastSampleMs;
    if (dtMs <= 0) return this.#extentPx; // duplicate/out-of-order sample -- ignore rather than divide by ~0

    const dy = this.#lastY - y; // screen Y decreases upward -- dragging up = positive = extend/PULL
    this.#lastY = y;
    this.#lastSampleMs = nowMs;

    this.#extentPx = Math.min(BELLOWS_MAX_PX, Math.max(BELLOWS_MIN_PX, this.#extentPx + dy));
    this.#velocityDegPerS = (dy / (dtMs / 1000)) * PX_PER_S_TO_DEG_PER_S;
    return this.#extentPx;
  }

  end(): void {
    this.#dragging = false;
    this.#velocityDegPerS = 0;
  }

  /** Same units/scale as the lid sensor's angular velocity -- pass straight to BellowsPressure.update(). */
  velocity(nowMs: number): number {
    if (!this.#dragging) return 0;
    if (nowMs - this.#lastSampleMs > STILL_TIMEOUT_MS) return 0;
    return this.#velocityDegPerS;
  }
}
