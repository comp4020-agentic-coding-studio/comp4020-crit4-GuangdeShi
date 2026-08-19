# Crit 4 — An instrument

**What was the breakthrough that moved the work forward?**

The breakthrough wasn't a single fix — it was noticing how much a visual
prototype can lie to you if you only ever look at it at the zoom level you
built it at. Twice this week I "confirmed" something was fine (an idle mouth
existed; a semicolon glyph was legible) by glancing at the full stage, and
twice a closer crop revealed the thing wasn't actually there or wasn't
actually readable. The shift that mattered was making that close-up crop a
standard step rather than a one-off: check the whole stage for composition,
then crop each element that has to individually carry meaning (a face, a
chest letter) before believing it's correct. That habit is what caught the
missing mouth and the illegible semicolon — both would have shipped
otherwise, since neither is something a DOM-structure test can see.

**What did this work change about who I want to be as a software developer?**

It sharpened a distinction I'd been fuzzy on: passing tests and being
*correct* are not the same claim, especially for anything visual or audible.
`pnpm check` was green through both bugs. I want to keep the discipline this
crit forced on me — treating "the automated checks pass" as necessary but not
sufficient, and building small, disposable verification harnesses (a
standalone HTML page to iterate on an SVG shape, a Playwright script that
instruments the browser's own APIs) when the thing I actually need to know
isn't something a unit test can express. That's a more expensive habit than
trusting green CI, but this week is exactly the case for it: an instrument
that's supposed to be looked at and listened to.
