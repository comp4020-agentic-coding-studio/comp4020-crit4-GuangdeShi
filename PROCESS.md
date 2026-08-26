# Process overview

## What I built

A MacBook Accordion. The physical keyboard is a two-octave chromatic manual
(C3–C5); pressing a key produces an immediately audible reed tone on its
own. The MacBook's own lid is the bellows — its native angle sensor shapes
that tone's dynamics, timbre, and a small pitch expression as it moves. The
public GitHub Pages copy has no access to that sensor, so a second input
mode lets a stranger drag the on-screen bellows with mouse/touch/pointer
instead, shaping the same tone the same way. One instrument, two bellows
interfaces, never two separate instruments.

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

**That "silent until moving" model was itself wrong, found by playing it,
not by a test.** Manually playing the shipped instrument made the "keys
produce a base reed tone / bellows movement shapes its dynamics, timbre and
subtle pitch expression" requirement obvious in a way no automated check
caught: a still-bellows key press was gated to near-silence, so the
instrument felt broken the instant someone pressed a key without also
moving the lid or dragging the fallback bellows. Rebuilt `setBellows()`
around a fixed audible baseline gain that bellows pressure adds *on top of*
rather than gates from zero, and added a small (-10..+15 cent) pitch bend
tied to push/pull direction, at
[`9556f90`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/9556f90).
Re-measuring the live output with the same analyser-tap technique as above
then found the *original* limiter/compressor settings — tuned around the
old near-silent baseline — were crushing the new, much louder baseline's
entire pp→ff swing to under 1dB at the final output stage even though the
pre-limiter signal still carried a healthy swing; retuning `MASTER_GAIN`,
the compressor threshold and the limiter threshold restored a genuine
audible dynamic range without reopening the earlier chord-clipping problem
(re-checked with a 6-note chord at full pressure: peak 0.965, zero clipped
samples).
