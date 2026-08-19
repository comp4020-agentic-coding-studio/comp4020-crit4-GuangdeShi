// A shared lookahead scheduler --- one clock that every looping layer reads
// from, so kick/snare/hi-hat subdivisions always line up instead of drifting
// apart like independent setInterval timers would. Pattern: Chris Wilson's
// "A Tale of Two Clocks" (an imprecise setInterval "checker" that schedules
// exact future AudioContext times, well ahead of when they're due to sound).
import type { DrumId } from "./drum-audio";
import { getContext, playDrum } from "./drum-audio";

export type Subdivision = "1/2" | "1/4" | "1/8" | "1/16";

// How many shared sixteenth-note steps make up one hit at each subdivision.
// The grid runs in sixteenths so "1/16" is the finest layer today and every
// coarser value divides it evenly; a bar is 16 steps (4 beats of 4
// sixteenths), which is also where the step counter wraps.
const STEPS_PER_HIT: Record<Subdivision, number> = {
  "1/2": 8,
  "1/4": 4,
  "1/8": 2,
  "1/16": 1,
};
const STEPS_PER_BAR = 16;

// Fixed for this slice --- a single named constant is the one place a future
// tempo control needs to reach in, rather than a value threaded through the
// scheduler's internals.
const BPM = 96;
const SIXTEENTH_SECONDS = 60 / BPM / 4;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

const layers = new Map<DrumId, Subdivision>();

let timerId: number | null = null;
let rafId: number | null = null;
let step = 0;
let nextStepTime = 0;
let visualQueue: Array<{ time: number; id: DrumId }> = [];
let onScheduledHit: ((id: DrumId) => void) | null = null;

export function setScheduledHitListener(listener: (id: DrumId) => void): void {
  onScheduledHit = listener;
}

function scheduleStep(time: number): void {
  for (const [id, subdivision] of layers) {
    if (step % STEPS_PER_HIT[subdivision] === 0) {
      playDrum(id, time);
      visualQueue.push({ time, id });
    }
  }
}

function tick(): void {
  const context = getContext();
  while (nextStepTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
    scheduleStep(nextStepTime);
    nextStepTime += SIXTEENTH_SECONDS;
    step = (step + 1) % STEPS_PER_BAR;
  }
}

// Fires visual reactions at the same AudioContext time the sound was
// scheduled for, rather than whenever the setInterval happens to run ---
// requestAnimationFrame gives per-frame precision for "is this hit due yet".
function visualLoop(): void {
  const context = getContext();
  while (visualQueue.length > 0 && visualQueue[0].time <= context.currentTime) {
    const note = visualQueue.shift();
    if (note) onScheduledHit?.(note.id);
  }
  rafId = requestAnimationFrame(visualLoop);
}

function ensureRunning(): void {
  if (timerId !== null) return;
  const context = getContext();
  step = 0;
  nextStepTime = context.currentTime + 0.05;
  timerId = window.setInterval(tick, LOOKAHEAD_MS);
  rafId = requestAnimationFrame(visualLoop);
}

function stopIfIdle(): void {
  if (layers.size > 0) return;
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  visualQueue = [];
}

// The single entry point a rhythm dial calls: null/undefined turns a layer
// off, any Subdivision turns it on (or changes its rate) against the same
// shared clock every other active layer is already reading from.
export function setLayer(id: DrumId, subdivision: Subdivision | null): void {
  if (subdivision) {
    layers.set(id, subdivision);
    ensureRunning();
  } else {
    layers.delete(id);
    stopIfIdle();
  }
}

export function getLayer(id: DrumId): Subdivision | null {
  return layers.get(id) ?? null;
}
