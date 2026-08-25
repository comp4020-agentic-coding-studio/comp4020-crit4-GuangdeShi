# MacBook Accordion

A piano-accordion model where the physical keyboard picks the pitch and the
bellows supply air. There are **two ways to supply that air**, feeding the
same instrument:

- **Public URL (no install required).** Anyone opening the deployed page —
  a stranger with no native software — plays it with the physical keyboard
  or on-screen piano keys for pitch, and drags the large visual bellows with
  mouse, touch, or pen for bellows air. This is the fallback mode and is
  what runs automatically whenever the native sensor bridge below isn't
  connected.
- **Full physical version (this MacBook only).** With the native lid-sensor
  bridge running, the real screen hinge becomes the bellows instead — move
  the actual lid, don't drag on screen. Playable only on a MacBook with the
  lid-angle HID node this was built against (tested: MacBook Air, Mac15,12 /
  Apple M3). Requires `pnpm accordion` (below); see
  [`PROCESS-NOTES.md`](PROCESS-NOTES.md) for how that sensor was confirmed
  to work, and [`TOMORROW.md`](TOMORROW.md) for current state and next
  steps.

Which mode is active is chosen automatically — never a settings toggle — and
shown in a small status line on the page itself ("LID BELLOWS" vs.
"DRAG BELLOWS"). Both modes drive the exact same pressure/expression model
and audio engine; dragging is never required while the real sensor is
connected, and the sensor path is never weakened by the fallback existing.

## Branch

```
git checkout plan-c-mac-accordion
```

## Install

From the repo root:

```
pnpm install
```

## Full physical version — start everything (one command)

```
pnpm accordion
```

This runs [`scripts/start-accordion.sh`](../../scripts/start-accordion.sh),
which starts the native lid-sensor bridge
(`accordion/bridge/server.mjs`, streaming `accordion/native/lid-reader.swift`
telemetry over `ws://localhost:8765`) and the Vite dev server together.
Ctrl+C stops both.

Open **http://localhost:5173/** once the dev server line appears.

## Start manually (if the one-liner is ever unreliable)

Two terminals, from the repo root:

```
node plan-c/accordion/bridge/server.mjs
```

```
pnpm dev
```

Then open the same URL above.

## Playing it

- Physical keyboard keys, or clicking/tapping the on-screen piano keys, pick
  notes across a C3–C5 chromatic range (see root [`keyboard.ts`](../../keyboard.ts)
  for the exact layout). A held key with no bellows air is close to silent,
  by design — bellows air alone, with no key held, is silent too.
- **Full physical mode** (bridge connected): move the actual laptop lid to
  supply bellows air.
  - **Safe lid range**: keep well inside the hinge's normal open range.
    Don't force it flat/closed to chase more "pressure" — full closure will
    put the machine to sleep, and near-closure hasn't been part of the
    tested playable range.
  - Practical playable range tested so far: roughly 5–35 deg/s of lid
    angular velocity, moving within a normal ~45°–115° screen-angle gesture,
    covers the soft-to-loud dynamic range (see root [`bellows.ts`](../../bellows.ts) /
    `PROCESS-NOTES.md` Round 3 for the exact curve). Sustained speeds above
    that saturate at maximum bellows pressure rather than getting louder
    still.
- **Drag-fallback mode** (bridge not connected — the default on the public
  URL): grab the large bellows itself with mouse, touch, or pen and move it
  vertically. Dragging up expands it (PULL), dragging down compresses it
  (PUSH); how fast you move it, not how far, is what drives loudness and
  brightness — a slow drag reads soft, a fast one reads loud, and releasing
  lets it settle back to silence.
- Which mode is live is shown in the small status line under the
  instrument ("LID BELLOWS" or "DRAG BELLOWS") — chosen automatically, no
  settings panel. If the sensor bridge isn't running (or the WebSocket
  drops), the page falls back to drag mode rather than substituting fake
  sensor input — this is expected, not a bug.

## Checks

```
pnpm check
```

Runs typecheck, build, and the Vitest suite (`bellows.ts`'s pressure model
and `keyboard.ts`'s layout are both directly unit-tested; audio output
itself needs the manual listening pass above, not a check).
