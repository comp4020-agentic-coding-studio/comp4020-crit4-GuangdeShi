import { SensorClient } from "./sensor-client.ts";
import { BellowsModel } from "./bellows.ts";
import { AccordionEngine } from "./audio-engine.ts";

const statusEl = document.querySelector<HTMLElement>("#sensor-status")!;
const angleEl = document.querySelector<HTMLElement>("#debug-angle")!;
const velocityEl = document.querySelector<HTMLElement>("#debug-velocity")!;

const sensor = new SensorClient();
const bellows = new BellowsModel();
const engine = new AccordionEngine();

sensor.onStateChange((state) => {
  statusEl.dataset.state = state;
  statusEl.textContent = state === "connected" ? "Sensor connected" : "Waiting for MacBook sensor…";
});

let latestVelocity = 0;

sensor.onTelemetry(({ angle, velocity }) => {
  latestVelocity = velocity;
  angleEl.textContent = `${angle.toFixed(1)}°`;
  velocityEl.textContent = `${velocity >= 0 ? "+" : ""}${velocity.toFixed(1)}°/s`;
});

// Bellows pressure is recomputed every frame (not just on new telemetry) so
// it keeps decaying smoothly between sensor samples instead of stair-stepping.
function bellowsLoop(nowMs: number): void {
  const { pressure, direction } = bellows.update(latestVelocity, nowMs);
  engine.setBellows(pressure, direction);
  requestAnimationFrame(bellowsLoop);
}
requestAnimationFrame(bellowsLoop);
