// Plan C accordion bridge: the smallest robust hop from the native lid
// reader to the browser. It does NOT reimplement sensor reading (that's
// ../native/lid-reader.swift, already proven to produce live angle/
// velocity data -- see ../../investigation/FINDINGS.md). It only spawns
// that reader, re-broadcasts each JSON line it prints to every connected
// browser tab over a local WebSocket, and restarts it if it exits.
//
// Run: node plan-c/accordion/bridge/server.mjs
// (or `pnpm accordion`, which runs this alongside `vite dev`.)

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WebSocketServer } from "ws";

const PORT = 8765;
const READER_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "native", "lid-reader.swift");

const wss = new WebSocketServer({ port: PORT });
console.log(`[bridge] listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  console.log(`[bridge] browser connected (${wss.clients.size} total)`);
  ws.on("close", () => console.log(`[bridge] browser disconnected (${wss.clients.size} total)`));
});

function broadcast(line) {
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(line);
  }
}

let restartTimer = null;

function startReader() {
  console.log(`[bridge] starting lid reader: swift ${READER_PATH}`);
  const child = spawn("swift", [READER_PATH], { stdio: ["ignore", "pipe", "pipe"] });

  createInterface({ input: child.stdout }).on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("{")) broadcast(trimmed);
  });

  createInterface({ input: child.stderr }).on("line", (line) => {
    console.error(`[lid-reader] ${line}`);
  });

  child.on("exit", (code, signal) => {
    console.error(`[bridge] lid reader exited (code=${code} signal=${signal}), restarting in 2s`);
    clearTimeout(restartTimer);
    restartTimer = setTimeout(startReader, 2000);
  });

  child.on("error", (err) => {
    console.error(`[bridge] failed to start lid reader: ${err.message}`);
  });
}

startReader();

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
