import { describe, expect, it } from "vitest";
import { BellowsPressure } from "./bellows.ts";

// BellowsPressure is pure logic (no AudioContext/DOM), so its physics --
// the actual "does this behave like a bellows" contract from the
// piano-accordion spec -- can be verified directly instead of only by ear.

function run(velocitiesDegPerS: number[], stepMs = 16): number[] {
  const bellows = new BellowsPressure();
  const pressures: number[] = [];
  let now = 0;
  for (const velocity of velocitiesDegPerS) {
    now += stepMs;
    pressures.push(bellows.update(velocity, now).pressure);
  }
  return pressures;
}

describe("BellowsPressure", () => {
  it("stays silent (zero pressure) while the screen is still", () => {
    const pressures = run(Array(20).fill(0));
    expect(pressures.every((p) => p === 0)).toBe(true);
  });

  it("ignores tiny jitter under the dead zone", () => {
    const pressures = run(Array(20).fill(1.5)); // below DEAD_ZONE_DEG_PER_S
    expect(pressures.every((p) => p < 0.01)).toBe(true);
  });

  it("builds pressure toward 1 as sustained movement continues, and saturates rather than exceeding 1", () => {
    const pressures = run(Array(60).fill(200)); // far above saturation speed
    expect(pressures.at(-1)).toBeCloseTo(1, 1);
    expect(Math.max(...pressures)).toBeLessThanOrEqual(1);
  });

  it("decays toward zero after movement stops, rather than cutting instantly", () => {
    const bellows = new BellowsPressure();
    let now = 0;
    for (let i = 0; i < 60; i++) {
      now += 16;
      bellows.update(80, now);
    }
    const justAfterMoving = bellows.update(0, (now += 16)).pressure;
    expect(justAfterMoving).toBeGreaterThan(0.01); // still has residual pressure, not silent
    let latest = justAfterMoving;
    for (let i = 0; i < 150; i++) {
      now += 16;
      latest = bellows.update(0, now).pressure;
    }
    expect(latest).toBeLessThan(0.01); // eventually settles back to silence
  });

  it("reports PULL for positive velocity and PUSH for negative velocity", () => {
    const bellows = new BellowsPressure();
    expect(bellows.update(80, 16).direction).toBe(1);
    expect(bellows.update(-80, 32).direction).toBe(-1);
  });

  it("keeps the last direction while pressure is still decaying, then returns to rest once silent", () => {
    const bellows = new BellowsPressure();
    let now = 0;
    for (let i = 0; i < 30; i++) {
      now += 16;
      bellows.update(80, now);
    }
    const decaying = bellows.update(0, (now += 16));
    expect(decaying.direction).toBe(1); // still fading, direction persists
    let last = decaying;
    for (let i = 0; i < 300; i++) {
      now += 16;
      last = bellows.update(0, now);
    }
    expect(last.direction).toBe(0); // fully at rest now
  });

  it("spreads slow/medium/fast sustained movement across clearly different pressures (not clustered near either end)", () => {
    // Steady-state pressure at each sustained velocity -- enough iterations
    // for the attack smoothing to fully settle.
    function steadyState(velocityDegPerS: number): number {
      const bellows = new BellowsPressure();
      let now = 0;
      let pressure = 0;
      for (let i = 0; i < 200; i++) {
        now += 16;
        pressure = bellows.update(velocityDegPerS, now).pressure;
      }
      return pressure;
    }

    const slow = steadyState(5); // deliberate, slow movement -- should read as soft, not silent
    const medium = steadyState(20); // comfortable everyday movement -- should read as a normal mid-volume
    const fast = steadyState(35); // fast but safe -- should read as clearly loud
    const max = steadyState(50); // saturates at full pressure

    expect(slow).toBeGreaterThan(0.05);
    expect(slow).toBeLessThan(0.3);
    expect(medium).toBeGreaterThan(0.3);
    expect(medium).toBeLessThan(0.65);
    expect(fast).toBeGreaterThan(0.6);
    expect(fast).toBeLessThan(0.95);
    expect(max).toBeCloseTo(1, 1);

    // Strictly increasing and clearly separated -- this is the actual bug
    // this pass fixes: medium and fast used to land close enough together
    // that the difference wasn't reliably audible.
    expect(medium - slow).toBeGreaterThan(0.15);
    expect(fast - medium).toBeGreaterThan(0.15);
  });

  it("dips effective pressure briefly on a direction reversal, without dropping to silence", () => {
    const bellows = new BellowsPressure();
    let now = 0;
    let steady = 0;
    for (let i = 0; i < 40; i++) {
      now += 16;
      steady = bellows.update(80, now).pressure; // sustained pull, pressure settles high
    }
    const justAfterReversal = bellows.update(-80, (now += 16)).pressure; // reverse to push
    expect(justAfterReversal).toBeGreaterThan(0); // articulation dip, not a full mute
    expect(justAfterReversal).toBeLessThan(steady); // but audibly softer than mid-sustain
  });
});
