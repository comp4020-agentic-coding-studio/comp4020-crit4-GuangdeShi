# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so look at the deployed head when you add pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This week: C4, "An instrument" — MacBook Accordion

The published spec at
[crits/04-instrument](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/)
is the source of truth — re-read it before changing scope, not this summary.
See [`plan-c/accordion/`](plan-c/accordion/) for the instrument itself and
[`plan-c/accordion/PROCESS-NOTES.md`](plan-c/accordion/PROCESS-NOTES.md) for
the detailed build history.

- **The browser is the instrument.** Sound is synthesised live in the page by
  the player, not played back. There is no separate "start" screen, and
  AudioContext is created lazily on the player's first key press or pointer
  interaction, not behind an onboarding step.
- **No prerecorded audio samples.** Every reed voice is built from Web Audio
  API primitives (oscillators, filters, envelopes).
- **No game mechanics.** No score, health, win/fail state.
- **Two input modes, one instrument — never two.** The real MacBook lid
  sensor (when the native bridge is connected) is the primary, intended
  interaction on the hardware this was built for; pointer/touch dragging on
  the visual bellows is the public-URL fallback for a stranger with no
  native bridge. Both feed the identical `BellowsPressure`/`AccordionEngine`
  model — never fork the audio logic per input source, and never require the
  fallback drag while the sensor is connected.
- **Keys select pitch and are always audible on their own; bellows are
  expressive modulation, never a gate.** Pressing a key must produce a
  clearly audible note at a baseline "mp" level with the bellows
  completely still — a still-bellows key must never be silent or near-
  silent. Bellows motion then pushes loudness/brightness up toward "ff"
  and adds a small pitch bend on top of that baseline; it never controls
  *whether* a held note sounds, only how expressive it is. A moving
  bellows with no key held must still stay silent — don't reintroduce a
  standalone bellows noise.
- **Test all input paths by hand each session**: physical keyboard, mouse and
  touch/pointer on the visual piano keys, and the bellows itself both ways —
  the lid sensor (if the native bridge is running) and pointer/touch drag.
  None of this is covered by the automated spec tests below.
- **Low latency and human listening judgement over automated proof.** A
  passing test suite doesn't mean the synthesis sounds like an accordion or
  feels responsive — say so explicitly rather than inferring audio quality
  from green checks.
- **Commit meaningful stages separately** rather than bundling unrelated
  changes into one commit — the commit history is itself process evidence.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.
