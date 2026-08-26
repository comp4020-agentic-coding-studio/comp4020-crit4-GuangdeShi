# Plan C process notes: MacBook Accordion

Concise running record of how this branch got here and where it's going.
Not a polished writeup — see commit history and the `FINDINGS.md` files for
full detail; this is the map between them.

## The three plans

- **Plan A — Bonkappella** (`main`, also `worktree-bonkappella-redesign`): an
  a cappella crowd instrument, eight singers on a stage, home-row keys trigger
  bonk reactions + Web Audio voices. Untouched by this branch.
- **Plan B — Drum Kit** (`plan-b-drums`): a drum-kit instrument. Untouched by
  this branch.
- **Plan C — MacBook Accordion / Bellows** (`plan-c-mac-accordion`, this
  branch): the real MacBook lid hinge becomes the bellows. Physical keyboard
  keys pick notes; opening/closing the lid drives bellows pressure, which
  drives loudness and tone via Web Audio.

## How Plan C actually got built, in order

1. **Early spike: which sensor could stand in for bellows motion at all.**
   Three candidate browser/native signals were tried and compared in
   `plan-c/bellows-spike/`: camera (row-profile shift detection), IMU
   accelerometer/gyro, and ambient light. Camera won (`FINDINGS.md`:
   directionally reliable, "USABLE" intensity/stability, pure browser); the
   other two were architectural dead ends — both are private
   `AppleSPUHIDInterface` sensor-hub nodes with no public read path, not a
   "signal too weak" problem. The leftover camera proof-of-concept
   (`plan-c/bellows-spike/camera/`) is kept as evidence of that phase, even
   though the project moved on to a better signal before building on it.

2. **The real lid-angle sensor looked viable, then didn't, then did.**
   A known reverse-engineered HID node (VendorID `0x05AC`, ProductID
   `0x8104`, UsagePage `0x20`/Usage `0x8A`) was found and matched exactly on
   this MacBook Air. Polling it during dedicated test windows returned a
   value frozen at `122`/`123` regardless of physically swinging the lid —
   first verdict: **not viable on this hardware**
   (`plan-c/investigation/FINDINGS.md`, first "Verdict" section, kept
   in place as real evidence of what was actually observed).
   Cross-checking against two independent, working lid-angle readers
   (`lid-angle-rs`, `LidAngleSensor.app`) showed the hardware clearly *was*
   live — the app's own window tracked real hinge movement. Several
   code-level hypotheses (facet-matching, entitlements, report parsing) were
   tested and falsified one by one. The actual cause was simpler: every
   earlier "frozen" test had requested lid movement without confirming it
   was happening *during* the sampling window — a test-methodology gap, not
   a sensor or code defect. Once sampling and movement were run together,
   the same unmodified reader swept smoothly across the real ~80°–128°
   range with correctly-signed velocity. **Updated verdict: viable.**

3. **First playable browser prototype.** With the sensor proven, built the
   full chain in `plan-c/accordion/`: a WebSocket bridge relaying the Swift
   lid-reader's JSON stream to the browser (`bridge/server.mjs`), a bellows
   pressure model driven by `|velocity|` rather than absolute angle
   (`src/bellows.ts`), a Web Audio reed-bank synth (`src/audio-engine.ts`),
   an 8-white/5-black physical-keyboard note mapping (`src/keyboard.ts`), and
   a vintage wine-red/brass accordion visual with a horizontal
   bellows-left/keyboard-right layout (`index.html`, `src/styles.css`,
   `src/visuals.ts`). Verified with Playwright screenshots (key-press glow
   feedback, mobile-viewport overflow) since the repo has no existing
   headless-browser tooling for this kind of visual check.

## Current redesign priorities (this round of work)

Manual testing of the first prototype surfaced real problems, now being
worked through on this same branch:

- **Sound too quiet/weak**, and **some keys don't reliably sound** — the
  latter traced to a note-retrigger bug in `audio-engine.ts`: releasing and
  quickly re-pressing the same key inside the ~0.22s release/cleanup window
  found the old voice still in the voices map and silently dropped the new
  `noteOn`.
- **Layout is wrong**: horizontal bellows-left/keyboard-right doesn't read as
  intended. Redesigning to vertical — large, dominant bellows on top (the
  "heart of the instrument," breathing via a height/glow readout of real
  angle+velocity), smaller keyboard/manual below.
- **Keyboard too small**: expanding from one octave (13 keys) to two full
  octaves (25 keys, C3–C5) across the lower row, home row, and upper row.
- **Timbre too thin/generic**: reworking harmonic mixture, detune spread,
  filter response, and gain staging in `audio-engine.ts` for a louder,
  fuller, more reed-like sound that still stays quiet at rest and comes
  alive under bellows motion.

See the commit history on `plan-c-mac-accordion` from this point forward for
what actually changed.

## Round 2: from "bellows makes noise" to a real piano-accordion model

The first prototype had the instrument model itself backwards: moving the
lid generated a standalone noise-burst sound, and that noise was scaled by
bellows motion rather than gated by which reed(s) were actually open. A real
accordion never works that way -- the keys select pitch, the bellows only
supply air to whichever reed is already selected, and a moving bellows with
no key held is silent. This round rebuilt the instrument around that model:

- **`src/bellows.ts`** was rewritten from a `BellowsModel` (which mixed
  pressure computation with the old noise-triggering logic) into a pure
  `BellowsPressure` class: `|velocity|` -> dead-zone -> saturate -> smoothed
  pressure, plus a direction-reversal "articulation dip" for the small
  hiccup real bellows have when pull becomes push. It has no audio
  dependency at all and is unit-tested directly (`bellows.test.ts`).
- **`src/audio-engine.ts`** was rewritten from a flat `Voice` map + standalone
  noise generator into `ReedBank` (fixed harmonic waveforms shared by every
  note) + `NoteValve` (one held key's oscillator bank + envelope) +
  `AccordionEngine`, which feeds every open `NoteValve` into one shared
  `#airBus` gain node -- so `setBellows()` drives the loudness of every
  currently-held note at once, and a note's oscillator `frequency` is set
  once at valve construction and never touched by anything bellows-related.
  There is no code path left that can produce sound from lid motion alone.
- **Note-mapping / polyphony audit** (no bug found beyond what was already
  fixed): re-checked `main.ts`'s key handling against the standard "silent
  key" failure modes -- `event.key` vs `event.code`, case handling,
  OS auto-repeat, envelope scheduling, voice lifecycle, and a bellows gate
  that could accidentally mute specific notes. The `heldKeys` Set dedupes
  auto-repeat, all key comparisons are consistently lowercased, `blur`
  releases everything, and the prior session's `noteOn`/`reopen()`
  retrigger fix carried over cleanly into the new `NoteValve` class. Since
  every held note shares the *same* `#airBus`, "quiet at rest" is the
  intended Section-2 behaviour (no bellows motion = no air = near-silence),
  not a selective mute bug. Verified concretely with a throwaway Playwright
  script (not part of this repo -- `playwright` isn't a project dependency)
  that monkey-patched `AudioContext.prototype.createOscillator` to log every
  oscillator actually created: all 25 rendered keys produced exactly 4
  oscillators each when pressed individually, and a 3-note chord produced
  exactly 12 simultaneously, with zero console/page errors.
- **`keyboard.test.ts`** turns the "every visible key must be playable"
  requirement into a standing automated check (no duplicate keys/notes,
  every entry has a finite positive frequency, white/black classification
  matches real piano geometry, strict chromatic ordering, and `KEY_TO_DEF`
  has exactly one entry per `KEY_LAYOUT` entry) instead of a one-off manual
  pass, so a future edit to the keyboard can't silently reintroduce a
  mismatched or silent key.

Manual listening (does it actually sound like an accordion reed, does
pressure feel like air rather than a volume knob, does reversing bellows
direction feel like a real hiccup rather than a glitch) is still owed and
can only be done by ear against the running app -- see the commit history
for what shipped, and test it locally with `pnpm dev`.

## Round 3: bellows dynamic range was too subtle, plus a real clipping bug

The interaction model from Round 2 (keyboard = pitch, bellows = air) was
confirmed correct, but manual listening found the audible gap between slow
and fast lid movement too small to reliably tell apart by ear. This round
kept the model exactly as-is and only widened the response:

- **`src/bellows.ts`**: the velocity→pressure ramp changed from a straight
  linear ramp to a concave curve (`pow(ratio, 0.75)`, saturation speed raised
  40→50 deg/s) so medium (~20 deg/s) and fast (~35 deg/s) sustained motion
  land at clearly separated steady-state pressures instead of both reading as
  "loud" -- see the new spread-pressure test in `bellows.test.ts` for the
  numeric contract this locks in.
- **`src/audio-engine.ts`**: `AIR_BUS_MIN_GAIN_WHEN_MOVING` lowered
  (0.045→0.02) so slow motion reads as genuinely soft, not "almost medium";
  the bus compressor's threshold raised and ratio eased (it was quietly
  flattening the widened dynamic swing back out); bellows pressure now also
  drives a direction-symmetric brightness/body-filter shift (louder bellows
  = brighter/richer tone, not just louder, on top of the existing smaller
  push/pull directional tilt).
- **A real clipping bug, found by direct measurement, not just listening.**
  Tapping the engine's actual output with a Playwright script (monkey-patched
  `AudioContext.prototype.createDynamicsCompressor`/`createWaveShaper` to
  grab an internal node, connected an `AnalyserNode` to it) showed a single
  note at medium bellows pressure already peaked over unity, and a 4-note
  chord at full pressure peaked at **6.07x** -- three detuned oscillators
  plus a sub-reed, times a chord, summing past what the existing gentle
  bus compressor could catch (its ballistics can't react to sample-level
  transient peaks). Fixed with a final deterministic soft-clip
  `WaveShaperNode` after the existing limiter: identity below 0.85, smooth
  `tanh` saturation above, so ordinary playing measures byte-for-byte
  identical to before the fix and only genuine transient peaks are caught.
  Re-measured after the fix: same worst-case chord now peaks at 0.97x, no
  clipping, quiet single-note playing unchanged.

Checkpoint commit: `Plan C: checkpoint expressive MacBook accordion
prototype`. See [`TOMORROW.md`](TOMORROW.md) for what's still owed (a real
by-ear A/B listening pass against the running app) and where to pick back up.

## Round 4: a public-fallback input mode, for the deployed page

Everything above only makes sound on the one MacBook this was built against
-- the deployed GitHub Pages copy has no native bridge to connect to, so a
stranger opening the public URL could never make it produce a note. The
requirement was explicit: build a *second input source* for the same
instrument, not a second instrument, and don't let the two modes fight or
require each other.

- **`src/drag-bellows.ts`** is a new, pure `DragBellows` class with no DOM or
  PointerEvent dependency (same reasoning as `bellows.ts`'s
  `BellowsPressure`: the drag-to-velocity math should be testable directly,
  not only by hand). It turns a `(clientY, timestampMs)` sample stream into
  a signed velocity in the exact same deg/s units `BellowsPressure.update()`
  already consumes -- dragging up is positive/PULL, down is negative/PUSH,
  matching the lid sensor's own sign convention. Its scale factor
  (`50 / 420`, px/s to deg/s) was derived from `bellows.ts`'s already-tuned
  `DEAD_ZONE_DEG_PER_S`/`SATURATE_DEG_PER_S` constants rather than retuned
  from scratch, so the fallback's dead-zone/saturation feel matches the
  physical lid without a second manual-tuning pass. `drag-bellows.test.ts`
  covers zero-before-drag, correct sign on both directions, saturation at a
  brisk drag speed, staying under the dead zone on a slow one, extent
  clamping at both ends of the visual range, dropping to zero the instant a
  drag ends, treating a paused-but-not-released drag as stale after ~90ms,
  and ignoring an out-of-order/duplicate timestamp instead of dividing by
  ~zero.
- **`src/main.ts`** picks between the two velocity sources with a single
  boolean, `sensorConnected`, derived from `SensorClient`'s own reported
  state (only `"connected"` counts -- both `"connecting"` and
  `"disconnected"` default to the drag fallback, so a cold page load never
  sits in an ambiguous "waiting for sensor" limbo). That one flag gates
  which velocity `bellowsLoop` reads each frame *and* which input is allowed
  to write the bellows' visual extent, so a stray pointer drag while the
  real sensor happens to be connected is simply inert -- the sensor
  interaction is never weakened or overridden, and dragging is never
  required while it's live. `#mode-status` shows "LID BELLOWS -- hold a key,
  move the screen." or "DRAG BELLOWS -- hold a key, drag the bellows."
  depending on that same flag; there's no settings panel and no tutorial.
- **`src/visuals.ts`**: `setAngle()` (the lid-sensor path) was refactored to
  delegate to a new `setExtentPx()`, which the drag path now also calls
  directly -- one shared visual-output seam for both input sources, per the
  "do not duplicate the audio/render logic" requirement.
- **Interaction quality** (`styles.css`, `main.ts`): the bellows element
  itself is the entire drag target (no separate handle/slider), using
  Pointer Events (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`)
  with explicit `setPointerCapture`/`releasePointerCapture`, `cursor: grab`
  / `.grabbing`, and `touch-action: none` + `user-select: none` so a
  touch-drag doesn't also scroll the page or select text.
- **Verification.** A throwaway Playwright instance (`/tmp/c4-verify`, not a
  project dependency) checked both required marking viewports
  (1920x1080, 390x844) for horizontal overflow, the mode-status text/state,
  and console/page errors. The first run showed "LID BELLOWS" / `connected`
  at rest, which looked suspicious until `lsof -i :8765` and `ps aux` traced
  it to a genuinely-still-running bridge process left over from an earlier
  session's `pnpm accordion` -- not a bug, just a real physical-sensor
  signal that happened to confirm physical mode still works correctly at
  both viewports. Killing that stray process and re-running confirmed the
  drag-fallback default state: no overflow, correct "DRAG BELLOWS" text,
  the bellows at a sensible default height, and the only console message
  the expected/benign WebSocket-connection-refused notice (never rendered
  into the page's own UI). A second script then simulated real drag
  gestures with a key held: silence with no drag, a soft reading on a slow
  upward drag, a loud reading and correct `pull`/`push` direction flip on a
  fast drag and its reversal, continued silence on a fast drag with *no*
  key held, and a louder chord reading with three keys held plus a drag --
  all with zero page errors, confirming the fallback drives the same
  pressure/direction model the lid sensor does, not a second one.

## Round 5: final interaction correction -- keys must sound on their own

Everything through Round 4 preserved Round 2's original model faithfully:
keys select pitch, the bellows supply air, and a key held with a still
bellows stays near-silent. Manually playing the shipped instrument (not a
test -- a person pressing a key and listening) showed that model itself was
the problem: a still-bellows key press read as *broken*, not *quiet*, to
anyone who hadn't already read the source. An accordion reed sounds the
instant its valve opens; the bellows shape how it sounds, they don't decide
whether it sounds at all. That's the correction this round makes.

- **`src/audio-engine.ts`**: `setBellows()`'s air-bus gain changed from
  `pressure > deadzone ? loud : AIR_BUS_MIN_GAIN_WHEN_MOVING` (effectively
  silent at rest) to `AIR_BUS_BASELINE_GAIN + pressure * (1 -
  AIR_BUS_BASELINE_GAIN)` -- a fixed, always-on "mp" baseline that bellows
  pressure adds *on top of*, never a floor pressure has to clear before
  anything is audible. `NoteValve` also gained a small pitch-bend path: each
  oscillator now carries its fixed musette `baseDetuneCents` separately from
  a live `bendCents` driven by bellows pressure and push/pull direction
  (-10 to +15 cents, recombined via `detune.setTargetAtTime` each frame),
  so fast bellows motion adds a subtle expressive wobble without transposing
  the note.
- **A second, genuine dynamic-range bug found the same way the Round 3
  clipping bug was found -- by tapping the actual output, not by ear.** The
  existing safety chain (compressor -> master gain -> limiter -> soft-clip)
  had been tuned around the old near-silent baseline, where only occasional
  full-pressure chords needed squashing. Under the new, much louder
  baseline, that same chain crushed nearly the entire pp->ff swing of
  ordinary single-note play down to under 1dB of audible difference at the
  final output -- confirmed by comparing an `AnalyserNode` tapped right
  before `ctx.destination` against a second one tapped right before the
  first compressor, which showed a healthy pre-limiter swing being erased
  downstream. Fixed by lowering `MASTER_GAIN` (1.6 -> 1) and raising the
  compressor threshold (-9 -> -4dB) and limiter threshold (-1 -> 0dB),
  restoring a clear, measurable baseline-to-full-pressure swing (~0.27 RMS
  at rest vs ~0.44-0.55 RMS under fast bellows, averaged over a
  musette-beat-length window) while re-checking the original chord-clipping
  scenario still holds: a 6-note chord at full bellows pressure peaks at
  0.965 with zero samples over 0.98, so the loosened margins didn't reopen
  Round 3's problem.
- **`src/main.ts`**: `pressKey()` now awaits `engine.resume()` (re-checking
  the key is still held afterward) instead of firing `resume()` and
  `noteOn()` concurrently, closing a race where a still-settling
  `AudioContext` (observed on Safari, which also exposes an "interrupted"
  state distinct from "suspended") could swallow the very first note of a
  session. Mode-status copy changed from "hold a key, move/drag the
  bellows" to "play the keys, move/drag the bellows to shape the sound",
  since the old wording implied a key alone made no sound.
- **Verification.** A Playwright script tapped both the pre- and
  post-safety-chain output with `AnalyserNode`s (patching
  `AudioNode.prototype.connect` from outside the page, so it proves what
  actually reaches the speakers rather than reading private engine state)
  and drove the physical-keyboard path (`page.keyboard.down/up`) concurrently
  with mouse-dragged bellows, confirming: a key alone produces sound at a
  measurable RMS with telemetry reading `0.00 --`; slow sustained bellows
  raises it to `mp`; fast sustained bellows raises it further to `f`/`ff`;
  releasing the bellows with the key still held decays back toward the same
  baseline level rather than to silence; and `pull`/`push` drags correctly
  flip the reported direction. Both bellows inputs -- lid sensor and
  pointer/touch drag -- were left structurally untouched (`bellows.ts`,
  `drag-bellows.ts`, `visuals.ts`, `keyboard.ts` needed no changes): this
  round is a correction to what the shared engine does with pressure, not a
  change to how pressure is measured or which input supplies it. Final
  design: one instrument, two bellows interfaces.
