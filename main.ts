import { SensorClient } from "./sensor-client.ts";
import { BellowsPressure } from "./bellows.ts";
import { DragBellows } from "./drag-bellows.ts";
import { AccordionEngine } from "./audio-engine.ts";
import { KEY_TO_DEF, renderKeyboard } from "./keyboard.ts";
import { AccordionVisuals } from "./visuals.ts";

renderKeyboard(
  document.querySelector<HTMLElement>("#white-row")!,
  document.querySelector<HTMLElement>("#black-row")!,
);

const modeStatusEl = document.querySelector<HTMLElement>("#mode-status")!;
const angleEl = document.querySelector<HTMLElement>("#debug-angle")!;
const velocityEl = document.querySelector<HTMLElement>("#debug-velocity")!;
const dynamicEl = document.querySelector<HTMLElement>("#debug-dynamic")!;

// Tuning aid only (Section 9 of the bellows-expression pass): a rough
// pp..ff label for the current pressure, so the dynamic range can be
// sanity-checked by eye alongside the raw numbers -- not meant to be a
// permanent/prominent part of the UI.
function dynamicLabel(pressure: number): string {
  if (pressure < 0.03) return "--";
  if (pressure < 0.12) return "pp";
  if (pressure < 0.28) return "p";
  if (pressure < 0.45) return "mp";
  if (pressure < 0.62) return "mf";
  if (pressure < 0.85) return "f";
  return "ff";
}

const sensor = new SensorClient();
const bellows = new BellowsPressure();
const drag = new DragBellows();
const engine = new AccordionEngine();
const visuals = new AccordionVisuals(document);

// Two input modes feed the one shared BellowsPressure/AccordionEngine model
// below -- the real MacBook lid sensor when it's connected (the primary,
// intended experience on the hardware this was built for), and pointer/
// touch dragging on the visual bellows otherwise (so the public GitHub
// Pages URL is independently playable by a stranger with no native bridge
// running). Selection is automatic, never a settings toggle: "connecting"
// (the state before any real telemetry has ever arrived) counts as
// "sensor unavailable," so a stranger opening the deployed page lands in
// drag mode immediately rather than sitting in a "waiting for sensor" limbo.
let sensorConnected = false;

sensor.onStateChange((state) => {
  sensorConnected = state === "connected";
  modeStatusEl.dataset.state = state;
  modeStatusEl.textContent = sensorConnected
    ? "LID BELLOWS — hold a key, move the screen."
    : "DRAG BELLOWS — hold a key, drag the bellows.";
});

let latestVelocity = 0;

sensor.onTelemetry(({ angle, velocity }) => {
  latestVelocity = velocity;
  if (sensorConnected) visuals.setAngle(angle);
  angleEl.textContent = `${angle.toFixed(1)}°`;
  velocityEl.textContent = `${velocity >= 0 ? "+" : ""}${velocity.toFixed(1)}°/s`;
});

// Bellows pressure is recomputed every frame (not just on new telemetry/drag
// samples) so it keeps decaying smoothly between them instead of
// stair-stepping.
function bellowsLoop(nowMs: number): void {
  const velocity = sensorConnected ? latestVelocity : drag.velocity(nowMs);
  const { pressure, direction } = bellows.update(velocity, nowMs);
  engine.setBellows(pressure, direction);
  visuals.setBellows(pressure, direction);
  dynamicEl.textContent = `${pressure.toFixed(2)} ${dynamicLabel(pressure)}`;
  requestAnimationFrame(bellowsLoop);
}
requestAnimationFrame(bellowsLoop);

const heldKeys = new Set<string>();

// A key must always produce sound by itself (Section 1/12) -- resume() is
// awaited and confirmed before noteOn() fires, rather than fired-and-forgotten
// alongside it, so a still-unlocking AudioContext (Safari in particular can
// still be settling `resume()` here) can't silently swallow the very first
// note of the session.
async function pressKey(key: string): Promise<void> {
  const def = KEY_TO_DEF.get(key);
  if (!def || heldKeys.has(key)) return; // ignore OS auto-repeat / already-held / unmapped
  heldKeys.add(key);
  visuals.setKeyPressed(key, true);
  await engine.resume();
  if (!heldKeys.has(key)) return; // released again before the (first-ever) resume settled
  engine.noteOn(key, def.frequency);
}

function releaseKey(key: string): void {
  if (!heldKeys.has(key)) return;
  heldKeys.delete(key);
  visuals.setKeyPressed(key, false);
  engine.noteOff(key);
}

window.addEventListener("keydown", (event) => {
  // Modifier combos (Cmd+A "select all", etc.) are never note input --
  // ignoring them here also stops the browser's own shortcut from firing
  // alongside a note by accident.
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (!KEY_TO_DEF.has(key)) return;
  event.preventDefault();
  pressKey(key);
});
window.addEventListener("keyup", (event) => releaseKey(event.key.toLowerCase()));
window.addEventListener("blur", () => {
  for (const key of [...heldKeys]) releaseKey(key);
});

// Mouse/touch can also play the visual keys, alongside the physical keyboard.
for (const [key, el] of visuals.keyElements) {
  el.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pressKey(key);
  });
  el.addEventListener("pointerup", () => releaseKey(key));
  el.addEventListener("pointerleave", () => releaseKey(key));
}

// Public-URL fallback: grab-and-drag the bellows itself with mouse, touch,
// or pen. Only affects sound while the physical lid sensor isn't connected
// (see bellowsLoop above) -- dragging is never required, and never
// overrides, the real MacBook lid. The bellows element is the entire
// interaction target on purpose (Section 7): no separate slider/handle.
const bellowsEl = document.querySelector<HTMLElement>("#bellows")!;

bellowsEl.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  bellowsEl.setPointerCapture(event.pointerId);
  bellowsEl.classList.add("grabbing");
  drag.start(event.clientY, performance.now());
});

bellowsEl.addEventListener("pointermove", (event) => {
  if (!drag.isDragging) return;
  const extentPx = drag.move(event.clientY, performance.now());
  if (!sensorConnected) visuals.setExtentPx(extentPx);
});

function endBellowsDrag(event: PointerEvent): void {
  if (!drag.isDragging) return;
  drag.end();
  bellowsEl.classList.remove("grabbing");
  try {
    bellowsEl.releasePointerCapture(event.pointerId);
  } catch {
    // Already released -- e.g. pointercancel firing after the browser
    // itself revoked capture (a touch scroll gesture taking over).
  }
}
bellowsEl.addEventListener("pointerup", endBellowsDrag);
bellowsEl.addEventListener("pointercancel", endBellowsDrag);
