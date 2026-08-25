import { SensorClient } from "./sensor-client.ts";

const statusEl = document.querySelector<HTMLElement>("#sensor-status")!;
const angleEl = document.querySelector<HTMLElement>("#debug-angle")!;
const velocityEl = document.querySelector<HTMLElement>("#debug-velocity")!;

const sensor = new SensorClient();

sensor.onStateChange((state) => {
  statusEl.dataset.state = state;
  statusEl.textContent = state === "connected" ? "Sensor connected" : "Waiting for MacBook sensor…";
});

sensor.onTelemetry(({ angle, velocity }) => {
  angleEl.textContent = `${angle.toFixed(1)}°`;
  velocityEl.textContent = `${velocity >= 0 ? "+" : ""}${velocity.toFixed(1)}°/s`;
});
