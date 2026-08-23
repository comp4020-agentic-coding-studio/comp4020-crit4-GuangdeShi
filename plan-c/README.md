# Plan C: MacBook lid-angle accordion — technical spike

This branch (`plan-c-mac-accordion`) is an isolated spike, not a build-out of
the instrument. It answers one question: **can the real MacBook lid hinge
angle be read locally and streamed into a browser to control Web Audio?**

See [`investigation/FINDINGS.md`](investigation/FINDINGS.md) for the result.

**Verdict: NOT VIABLE on this hardware** (MacBook Air, Mac15,12 / Apple M3).
The known HID lid-angle node exists and matches the expected identity, opens
and reads without any permission error, but its value does not track
physical hinge movement — and the driver rejects (`kIOReturnUnsupported`)
the one plausible way found to explicitly enable live reporting. See the
findings doc for the full diagnostic trail; the next worthwhile step is
running the same scripts on a MacBook Pro 14"/16" (2021+), not further
reverse-engineering this machine.

Per the spike's own ground rules, no fake/simulated sensor (slider, mouse
drag, device-orientation) was substituted, and no browser/audio code was
built on top of a sensor that doesn't work. Plan A (`main`) and Plan B
(`plan-b-drums`) are untouched.
