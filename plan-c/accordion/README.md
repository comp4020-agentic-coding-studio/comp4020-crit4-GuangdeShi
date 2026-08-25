# MacBook Accordion — run it locally

A piano-accordion model where the physical keyboard picks the pitch and the
real MacBook lid hinge supplies bellows air. Playable only on a MacBook with
the lid-angle HID node this was built against (tested: MacBook Air, Mac15,12
/ Apple M3) — see [`PROCESS-NOTES.md`](PROCESS-NOTES.md) for how that was
confirmed to work, and [`TOMORROW.md`](TOMORROW.md) for current state and
next steps.

## Branch

```
git checkout plan-c-mac-accordion
```

## Install

From the repo root:

```
pnpm install
```

## Start everything (one command)

```
pnpm accordion
```

This runs [`scripts/start-accordion.sh`](../../scripts/start-accordion.sh),
which starts the native lid-sensor bridge
(`accordion/bridge/server.mjs`, streaming `accordion/native/lid-reader.swift`
telemetry over `ws://localhost:8765`) and the Vite dev server together.
Ctrl+C stops both.

Open **http://localhost:5173/plan-c/accordion/** once the dev server line
appears.

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

- Physical keyboard keys pick notes across a C3–C5 chromatic range (see
  `src/keyboard.ts` for the exact layout).
- Move the actual laptop lid to supply bellows air — a still lid with a key
  held is close to silent, by design.
- **Safe lid range**: keep well inside the hinge's normal open range. Don't
  force it flat/closed to chase more "pressure" — full closure will put the
  machine to sleep, and near-closure hasn't been part of the tested playable
  range.
- Practical playable range tested so far: roughly 5–35 deg/s of lid angular
  velocity, moving within a normal ~45°–115° screen-angle gesture, covers the
  soft-to-loud dynamic range (see `src/bellows.ts` / `PROCESS-NOTES.md`
  Round 3 for the exact curve). Sustained speeds above that saturate at
  maximum bellows pressure rather than getting louder still.
- If the sensor bridge isn't running (or the WebSocket drops), the page
  shows "Waiting for MacBook sensor…" and stays silent rather than
  substituting fake input — this is expected, not a bug.

## Checks

```
pnpm check
```

Runs typecheck, build, and the Vitest suite (`bellows.ts`'s pressure model
and `keyboard.ts`'s layout are both directly unit-tested; audio output
itself needs the manual listening pass above, not a check).
