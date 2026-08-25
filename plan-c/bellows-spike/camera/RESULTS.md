# Experiment A results: camera global motion

Live test: 90s browser session at http://localhost:8934, physically opening,
closing, holding still, and doing quick open/close movements, with samples
logged to `bellows-camera.log` (not committed — regenerate by running
`server.py` and repeating the test).

## What the signal looked like

- **Direction is consistently signed.** Every observed "opening" motion
  produced positive `rawShift`; every observed "closing" motion produced
  negative `rawShift`. No sign flips across ~8 distinct movement events in
  the 90s window.
- **Magnitude scales with movement speed**, not just presence of movement:
  quick open/close swings (around t=74s, t=77s) produced `activity` up to
  ~16 and `strength` up to 0.80–0.81; slower, steadier swings only reached
  `strength` ≈ 0.2–0.5.
- **Slow/steady movement is weak.** Because the detector compares only
  consecutive frames (a velocity-like measurement), a slow continuous open
  over ~3s shows up as several short sub-second bursts rather than one
  sustained "OPENING" state — the frame-to-frame pixel shift during slow
  motion is often small enough to sit right at or below the dead zone.
- **Baseline noise floor is real but bounded.** Even with the lid untouched,
  `activity` idles at roughly 0–3 (occasional bumps to ~4 from auto-exposure
  or minor hand/desk vibration), which is why the dead zone (`0.35` shift
  units) and activity gate (`4`) were set where they are — comfortably above
  observed idle noise, below observed real-movement bursts.

## Interpretation

The underlying physical premise holds: a camera rigidly attached to the lid
does show coherent global motion correlated with real hinge movement, in a
consistent, distinguishable direction. As built, this experiment behaves
more like a **motion-velocity/edge detector** than a continuous position or
"is currently opening" state detector — good for quick gestures, weaker for
slow deliberate ones. A production version would likely want to integrate
(accumulate) shift over the gesture rather than react to each frame in
isolation, but that's beyond what this tiny spike needs to answer.

**Rating for the comparison table: USABLE.** Clear, repeatable, correctly-
signed direction; intensity that responds to movement speed; entirely
browser-based; but not yet "GOOD" because slow steady movement produces a
weaker/burstier signal than fast movement.
