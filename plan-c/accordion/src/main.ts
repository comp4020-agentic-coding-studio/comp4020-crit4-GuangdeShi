import { SensorClient } from "./sensor-client.ts";
import { BellowsModel } from "./bellows.ts";
import { AccordionEngine } from "./audio-engine.ts";
import { KEY_TO_DEF, renderKeyboard } from "./keyboard.ts";
import { AccordionVisuals } from "./visuals.ts";

renderKeyboard(
  document.querySelector<HTMLElement>("#white-row")!,
  document.querySelector<HTMLElement>("#black-row")!,
);

const statusEl = document.querySelector<HTMLElement>("#sensor-status")!;
const angleEl = document.querySelector<HTMLElement>("#debug-angle")!;
const velocityEl = document.querySelector<HTMLElement>("#debug-velocity")!;

const sensor = new SensorClient();
const bellows = new BellowsModel();
const engine = new AccordionEngine();
const visuals = new AccordionVisuals(document);

sensor.onStateChange((state) => {
  statusEl.dataset.state = state;
  statusEl.textContent = state === "connected" ? "Sensor connected" : "Waiting for MacBook sensor…";
});

let latestVelocity = 0;

sensor.onTelemetry(({ angle, velocity }) => {
  latestVelocity = velocity;
  visuals.setAngle(angle);
  angleEl.textContent = `${angle.toFixed(1)}°`;
  velocityEl.textContent = `${velocity >= 0 ? "+" : ""}${velocity.toFixed(1)}°/s`;
});

// Bellows pressure is recomputed every frame (not just on new telemetry) so
// it keeps decaying smoothly between sensor samples instead of stair-stepping.
function bellowsLoop(nowMs: number): void {
  const { pressure, direction } = bellows.update(latestVelocity, nowMs);
  engine.setBellows(pressure, direction);
  visuals.setBellows(pressure, direction);
  requestAnimationFrame(bellowsLoop);
}
requestAnimationFrame(bellowsLoop);

const heldKeys = new Set<string>();

function pressKey(key: string): void {
  const def = KEY_TO_DEF.get(key);
  if (!def || heldKeys.has(key)) return; // ignore OS auto-repeat / already-held / unmapped
  heldKeys.add(key);
  visuals.setKeyPressed(key, true);
  void engine.resume();
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
