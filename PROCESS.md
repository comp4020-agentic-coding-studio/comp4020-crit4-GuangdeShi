# Process overview

## What I built

An "A Cappella Crowd Instrument": eight stylised half-body singers staggered
across a landscape stage, each mapped to one home-row key (`A S D F J K L ;`).
Clicking, tapping, or pressing a singer's chest letter triggers a cartoon
"bonk" (eyes widen, mouth pops open, the whole figure recoils and springs
back) and a live Web Audio voice sounds at the same instant — one distinct
synthesis role per singer (bass, percussive, breath, hum, and four vowel
tones), built entirely from oscillators/noise/filters, no prerecorded samples.
There's no score, no health, no win or fail state: it's an instrument to play
with, not a game to win.

## The moments that mattered

**Layout occlusion, fixed at the system rather than the symptom.** The first
staggered layout placed back-row singers L and `;` at nearly the same
horizontal position as middle-row F and K. Depth-based `z-index` meant the
back row rendered underneath, so those two singers' chest letters were
completely hidden — invisible in every screenshot until I looked at the full
stage rather than one singer at a time. Nudging just those two would have
only relocated the same class of collision the next time a lane needed
adjusting, so instead I redesigned all eight x-positions as fixed lanes spaced
at least 12% apart regardless of depth row, which rules out the collision
structurally.
[`2cdf745`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/2cdf745)

**The idle mouth that was never actually there.** While wiring the bonk
reaction, I cropped a close-up of one singer's idle state to compare against
the new open-mouth animation, and realised the curve I'd been reading as a
"mouth" in every earlier screenshot was the clothing collar — every
`mouthIdle` path had been authored about 90 SVG units below the head, sitting
in the torso rather than the face. No singer had ever had a visible idle
mouth, and nothing automated caught it, since the spec tests check DOM
structure, not what a rendered SVG path actually looks like. I moved all
eight mouth paths onto the face rather than just the one I happened to be
checking, then re-cropped the same singer and the full stage to confirm a
genuine idle expression was visible.
[`8422a09`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/8422a09)

**A semicolon that failed legibility twice, caught by zooming further in.**
Early on I'd already "fixed" the `;` chest mark once, bumping its font-size
because the glyph read too small next to the other seven capital letters. A
later validation pass (after the audio commit) zoomed into a screenshot of
each chest mark individually, and the `;` at the larger size was still
unreadable — a blob, not a semicolon, because the font's thin comma-tail
doesn't survive a 3px stroke at that scale. The earlier fix had solved the
size problem I'd noticed but not the shape problem I hadn't looked closely
enough to see. This time I stopped trusting a font glyph at all: I built a
small standalone HTML page to iterate on a hand-drawn dot-and-comma SVG shape
at the right scale, screenshotted it in isolation until it clearly read as a
semicolon, and only then swapped it into the real markup, replacing the text
element for that one singer.
[`5534757`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/5534757)

**Verifying the cold-open rule by instrumenting the browser, not just reading
the code.** `CLAUDE.md` requires the `AudioContext` to exist only after a
real user gesture, never at page load. Rather than trust that my code
structure achieved this, I used Playwright to wrap the `AudioContext`
constructor in a `Proxy` before the page loaded and counted invocations: zero
before any click, exactly one after the first singer is hit, and still one
(not eight) after hitting several different singers — confirming the context
is created lazily and shared, not duplicated per voice.
[`92bfaa8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-GuangdeShi/commit/92bfaa8)
