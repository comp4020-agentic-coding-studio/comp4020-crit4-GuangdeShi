import { describe, expect, it } from "vitest";
import { BELLOWS_MAX_PX, BELLOWS_MIN_PX } from "./visuals.ts";
import { DragBellows } from "./drag-bellows.ts";

// DragBellows is pure logic (no DOM/PointerEvent), so the drag-to-velocity
// contract the public-URL fallback depends on -- up = PULL, down = PUSH,
// speed (not position) drives pressure, a released or stalled drag reads
// as still air -- can be verified directly, the same reason bellows.ts's
// BellowsPressure has its own dedicated test file instead of relying on
// manual dragging.

describe("DragBellows", () => {
  it("reports zero velocity before any drag starts", () => {
    const drag = new DragBellows();
    expect(drag.velocity(1000)).toBe(0);
  });

  it("reports a positive (PULL) velocity when dragging upward", () => {
    const drag = new DragBellows();
    drag.start(300, 0);
    drag.move(200, 100); // clientY decreased -- dragged up
    expect(drag.velocity(100)).toBeGreaterThan(0);
  });

  it("reports a negative (PUSH) velocity when dragging downward", () => {
    const drag = new DragBellows();
    drag.start(200, 0);
    drag.move(300, 100); // clientY increased -- dragged down
    expect(drag.velocity(100)).toBeLessThan(0);
  });

  it("saturates a quick, comfortable drag (~420px/s) to roughly the same 50deg/s ceiling as a fast lid swing", () => {
    const drag = new DragBellows();
    drag.start(300, 0);
    drag.move(300 - 42, 100); // 42px in 100ms == 420px/s
    expect(drag.velocity(100)).toBeCloseTo(50, 0);
  });

  it("keeps a slow drag under the equivalent of the lid sensor's dead zone", () => {
    const drag = new DragBellows();
    drag.start(300, 0);
    drag.move(300 - 2, 100); // 2px in 100ms == 20px/s, well under the ~25px/s dead-zone-equivalent
    expect(Math.abs(drag.velocity(100))).toBeLessThan(3);
  });

  it("clamps extent within the same px range the physical-lid readout uses", () => {
    const drag = new DragBellows();
    drag.start(1000, 0);
    for (let t = 1; t <= 50; t++) drag.move(1000 - t * 50, t * 16); // drag far past the top
    expect(drag.extentPx).toBe(BELLOWS_MAX_PX);

    drag.start(0, 900);
    for (let t = 1; t <= 50; t++) drag.move(t * 50, 900 + t * 16); // drag far past the bottom
    expect(drag.extentPx).toBe(BELLOWS_MIN_PX);
  });

  it("drops velocity to zero the instant the drag ends, rather than coasting on the last sample", () => {
    const drag = new DragBellows();
    drag.start(300, 0);
    drag.move(200, 100);
    expect(drag.velocity(100)).toBeGreaterThan(0);
    drag.end();
    expect(drag.velocity(100)).toBe(0);
  });

  it("treats a paused (not released) drag as still air once samples go stale", () => {
    const drag = new DragBellows();
    drag.start(300, 0);
    drag.move(200, 100);
    expect(drag.velocity(100)).toBeGreaterThan(0);
    // Still "dragging" (no pointerup), but no new move sample for a while --
    // a real hand that's stopped moving but hasn't let go yet.
    expect(drag.velocity(100 + 200)).toBe(0);
  });

  it("ignores an out-of-order or duplicate sample instead of dividing by ~zero", () => {
    const drag = new DragBellows();
    drag.start(300, 100);
    const before = drag.extentPx;
    const result = drag.move(200, 100); // same timestamp as start
    expect(result).toBe(before);
  });
});
