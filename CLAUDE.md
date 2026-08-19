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

## This week: C4, "An instrument"

The published spec at
[crits/04-instrument](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/)
is the source of truth — re-read it before changing scope, not this summary.

- **The browser is the instrument.** Sound is synthesised live in the page by
  the player, not played back. There is no separate "start" screen: the choir
  is the first thing a stranger sees, and AudioContext is created lazily on
  the player's first click/key press, not behind an onboarding step.
- **No prerecorded vocal samples in V1.** Every voice is built from Web Audio
  API primitives (oscillators, noise, filters, envelopes) until the convenor
  clarifies whether isolated a cappella samples are allowed. Don't fetch or
  bundle audio files for voices.
- **No game mechanics.** No score, health, win/fail state, or anything that
  frames hitting a singer as succeeding or failing. It's an instrument: hit a
  character, they sing, they return to idle.
- **Stay in the requested phase.** The four commits (setup, choir visual,
  interaction, Web Audio) are deliberately staged — don't pull sequencer,
  recording, or export work forward into V1 just because it would be easy
  while already in the file.
- **Test all three input paths by hand each session**: mouse click, keyboard
  (including holding/rapid-repeating a key and multiple keys at once), and
  touch (resize to a phone viewport or use dev-tools touch emulation). None of
  this is covered by the automated spec tests below.
- **Low latency and human listening judgement over automated proof.** A
  passing test suite doesn't mean the synthesis sounds good or feels
  responsive — say so explicitly rather than inferring audio quality from
  green checks.
- **Commit each of the four stages separately** (setup, choir visual,
  interaction, Web Audio) rather than bundling the week into one commit — the
  commit history is itself process evidence.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.
