# Plan C: MacBook lid-angle accordion

This branch (`plan-c-mac-accordion`) started as an isolated spike asking one
question: **can the real MacBook lid hinge angle be read locally and streamed
into a browser to control Web Audio?** It has since grown into a playable
browser prototype — see [`accordion/`](accordion/) for the current
instrument, and [`accordion/PROCESS-NOTES.md`](accordion/PROCESS-NOTES.md)
for the full arc from spike to prototype, and
[`accordion/TOMORROW.md`](accordion/TOMORROW.md) for where it's picking back
up.

**Current verdict: viable, and playable locally.** The initial diagnostic
pass (see [`investigation/FINDINGS.md`](investigation/FINDINGS.md), first
"Verdict" section) found the known lid-angle HID node frozen regardless of
physical movement, and concluded "not viable on this hardware." That
conclusion held only because of a test-methodology gap — every sampling
window had requested lid movement without confirming it was actually
happening *during* that window — not a hardware or sensor limitation.
Sampling and movement run together, the same reader tracks the real hinge
angle cleanly. `accordion/native/lid-reader.swift` +
`accordion/bridge/server.mjs` now stream that live telemetry into the
browser over a local WebSocket, driving a real piano-accordion model
(root [`bellows.ts`](../bellows.ts), [`audio-engine.ts`](../audio-engine.ts)):
the keyboard selects pitch, lid motion supplies bellows air/expression, and a
still lid means silence. The same model also ships at the repo root as the
deployed C4 instrument, with a pointer/touch drag fallback
([`drag-bellows.ts`](../drag-bellows.ts)) for anyone opening the public URL
without the native bridge running.

Per the spike's own ground rules, no fake/simulated sensor input was ever
substituted for the real one — the live prototype only exists because the
real signal turned out to work. Plan A (`main`) and Plan B (`plan-b-drums`)
remain untouched, preserved in git history and their own branches.
