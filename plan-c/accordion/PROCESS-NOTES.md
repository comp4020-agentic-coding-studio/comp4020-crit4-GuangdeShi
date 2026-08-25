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
