# Process overview

## What I built

A MacBook Accordion. The physical keyboard is a two-octave chromatic manual
(C3–C5); the MacBook's own lid is the bellows — its native angle sensor
drives air pressure into whichever reed(s) the held keys select, synthesised
live with Web Audio oscillators/filters/envelopes. The public GitHub Pages
copy has no access to that sensor, so a second input mode lets a stranger
drag the on-screen bellows with mouse/touch/pointer instead. Both modes feed
the identical `BellowsPressure`/`AccordionEngine` model — one instrument,
two ways to supply it air, never two separate instruments.

## The moments that mattered

**A sensor verdict that was wrong until re-tested properly.** The custom HID
lid-angle reader looked frozen at a fixed value under lid movement, and was
declared not viable. Cross-checking a known-working reader
(`LidAngleSensor.app`) showed the hardware was plainly live, so the fault had
to be in the test: earlier polling never confirmed the lid was actually
moving *during* the sampling window. With sampling and movement run
together, the same reader swept cleanly — Plan C resumed on that basis.
[`738e2ac`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/738e2ac)
(the false verdict) → reversed at
[`180be99`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/180be99).

**Fixing the instrument model, then its loudness, by evidence rather than
assumption.** The first prototype made the bellows itself generate a rushing
noise scaled by lid motion — listening back made clear that isn't how an
accordion works: keys select the open reed, the bellows only supply shared
air, and are silent with no key held. Rebuilt around that model
(`BellowsPressure`, `ReedBank`/`NoteValve`, a shared air bus) at
[`d4b8131`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/d4b8131).
Later, tapping the real audio output with an analyser — not just listening —
found a full chord at high pressure clipping at 6.07x unity; a deterministic
soft-clip stage fixed it to 0.97x at
[`90ba388`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/90ba388).
