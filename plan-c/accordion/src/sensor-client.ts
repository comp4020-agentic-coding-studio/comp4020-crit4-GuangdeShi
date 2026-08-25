// Thin WebSocket client for the Plan C accordion bridge
// (../bridge/server.mjs). Reconnects on drop, and treats a quiet socket
// (no telemetry line in a while) as disconnected even if the TCP
// connection itself is still technically open.

export interface Telemetry {
  angle: number;
  velocity: number;
}

export type ConnectionState = "connecting" | "connected" | "disconnected";

const BRIDGE_URL = "ws://localhost:8765";
const STALE_AFTER_MS = 1200;
const RECONNECT_DELAY_MS = 1000;

export class SensorClient {
  #lastMessageAt = 0;
  #state: ConnectionState = "connecting";
  #telemetryListeners = new Set<(t: Telemetry) => void>();
  #stateListeners = new Set<(s: ConnectionState) => void>();

  constructor() {
    this.#connect();
    window.setInterval(() => this.#checkStale(), 300);
  }

  onTelemetry(fn: (t: Telemetry) => void): void {
    this.#telemetryListeners.add(fn);
  }

  onStateChange(fn: (s: ConnectionState) => void): void {
    this.#stateListeners.add(fn);
    fn(this.#state);
  }

  #setState(next: ConnectionState): void {
    if (next === this.#state) return;
    this.#state = next;
    for (const fn of this.#stateListeners) fn(next);
  }

  #connect(): void {
    let socket: WebSocket;
    try {
      socket = new WebSocket(BRIDGE_URL);
    } catch {
      setTimeout(() => this.#connect(), RECONNECT_DELAY_MS);
      return;
    }

    socket.addEventListener("message", (event) => {
      this.#lastMessageAt = performance.now();
      this.#setState("connected");
      let data: unknown;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        return;
      }
      const t = data as Partial<Telemetry>;
      if (typeof t.angle === "number" && typeof t.velocity === "number") {
        for (const fn of this.#telemetryListeners) fn({ angle: t.angle, velocity: t.velocity });
      }
    });

    socket.addEventListener("close", () => {
      this.#setState("disconnected");
      setTimeout(() => this.#connect(), RECONNECT_DELAY_MS);
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  #checkStale(): void {
    if (this.#state === "connected" && performance.now() - this.#lastMessageAt > STALE_AFTER_MS) {
      this.#setState("disconnected");
    }
  }
}
