#!/usr/bin/env bash
# Starts everything the MacBook Accordion needs: the native-sensor bridge
# (spawns plan-c/accordion/native/lid-reader.swift, streams telemetry over
# a local WebSocket) and the Vite dev server, so `pnpm accordion` is the
# only command anyone needs to run. Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node plan-c/accordion/bridge/server.mjs &
BRIDGE_PID=$!
trap 'kill "$BRIDGE_PID" 2>/dev/null || true' EXIT

echo ""
echo "Open http://localhost:5173/plan-c/accordion/ once the dev server is ready."
echo ""

pnpm dev
