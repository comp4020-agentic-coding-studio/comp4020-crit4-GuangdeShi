# Tomorrow checkpoint — MacBook Accordion (Plan C)

Written at the end of tonight's session, checkpoint commit `90ba388`
("Plan C: checkpoint expressive MacBook accordion prototype") on
`plan-c-mac-accordion`, pushed to origin. See [`README.md`](README.md) to
start it and [`PROCESS-NOTES.md`](PROCESS-NOTES.md) for the full history.

## Current working state

- Live lid sensor works: `native/lid-reader.swift` reads the real hinge
  angle; confirmed viable after fixing a test-methodology gap (see
  `PROCESS-NOTES.md`, Round "looked viable, then didn't, then did").
- Browser bridge works: `bridge/server.mjs` streams angle + velocity over a
  local WebSocket to the page; reconnects on drop, shows "Waiting for
  MacBook sensor…" rather than faking data when absent.
- Angle and angular velocity both work and drive the model correctly.
- Bellows-pressure model works (`src/bellows.ts`): `|velocity|` → dead zone →
  concave curve → saturation → smoothed pressure, with a direction-reversal
  articulation dip. Correct piano-accordion interaction concept: keyboard =
  pitch, bellows = air/expression only, pitch never moves.
- C3–C5 chromatic keyboard works (25 keys), polyphony works (every open key
  shares one bellows pressure via a single air bus, like a real instrument).
- Current free-reed synthesis: `ReedBank` (unequal harmonic partials, no flat
  buzzy spectrum) + `NoteValve` (per-note oscillator bank + envelope) in
  `src/audio-engine.ts`, three-oscillator musette detune + a softer 16'
  sub-octave reed.
- Current visual: vertical layout, bellows breathing indicator on top,
  keyboard/manual below, vintage wine-red/brass styling.
- Tonight's pass: widened the slow/medium/fast bellows contrast (was too
  subtle to tell apart by ear) and fixed a real clipping bug found by direct
  output measurement (a chord at full pressure was peaking at 6x over unity;
  a final soft-clip stage now caps that at ~0.97x without touching normal
  playing levels). See `PROCESS-NOTES.md` Round 3 for the numbers.

## Current known weaknesses

- **Bellows expression was widened by parameter tuning + a steady-state unit
  test, not yet confirmed by an actual by-ear A/B listening pass on the
  running app with the real lid.** This is the most important thing to
  verify first thing tomorrow — do the manual test sequence below before
  trusting the numbers.
- Accordion timbre hasn't been tuned against real accordion reference
  recordings — it reads as "a reed instrument," not validated against "this
  specific character of reed."
- UI hasn't had a fresh visual critique since the vertical-layout redesign.
- Debug telemetry row now has a third value (`pressure` + `pp..ff` label) —
  tuning aid only, not reviewed for whether it should stay, shrink, or go
  before this is considered a finished prototype.
- No public deployment yet. GitHub Pages here only deploys on push to `main`
  (`.github/workflows/checks.yml`), and `vite.config.ts` deliberately
  excludes `plan-c/` from the production build — publishing a
  `.../plan-c/accordion/` URL means either merging into `main` or changing
  that exclusion, and merging is explicitly a *later* decision (see below),
  not a tonight one.

## Tomorrow's first tasks

1. **Manual A/B listening test** against the real lid, per
   `PROCESS-NOTES.md`: hold a key with the screen still (near silence) →
   move very slowly (soft, clearly audible) → normal comfortable rate
   (clearly stronger) → quick but safe (large jump). Repeat a few times. If
   slow vs. fast isn't reliably tellable by ear alone, keep tuning
   `bellows.ts`'s curve/`audio-engine.ts`'s gain range before anything else.
2. Tune slow-vs-fast bellows contrast further if step 1 says so.
3. Tune reed timbre closer to a real piano-accordion reference recording.
4. Manually inspect all white/black keys across the full C3–C5 range for
   silent-key or mistuned-note regressions.
5. Visual polish pass on the current vertical bellows/keyboard layout.
6. Decide whether Plan C is the final direction for this deliverable.
7. **Only then** consider merging/shipping — including deciding how (or
   whether) to expose `plan-c/accordion` through the deployed site, since
   that currently requires a deliberate `vite.config.ts` + `main` change,
   not a fast-follow.
