# Crit 4 — An instrument

**What was the breakthrough that moved the work forward?**

The breakthrough was refusing to accept a diagnosis just because the
automated samples behind it were internally consistent. The lid-angle
reader returned the same frozen value on every poll, and "not viable on
this hardware" looked well-supported — repeatable, deterministic, exactly
what a dead sensor would produce. But a piece of existing, independently
working software (`LidAngleSensor.app`) contradicted that inference: it
tracked the same hinge and moved. That contradiction was the signal to test
the assumption itself rather than the sensor code again — running lid
movement and sampling at the same time, instead of one after the other,
showed the reader had been working the whole time. The failure was in how
the test was structured, not in the hardware or the code. Listening played
the same role later: the bellows-as-noise-generator prototype passed every
check it had, and only hearing it revealed it wasn't behaving like an
accordion at all.

**What did this work change about who I want to be as a software developer?**

It sharpened where I put my trust when a tool's diagnosis and physical or
perceptual evidence disagree. Consistent automated output describes what a
test measured, not what's true — it can't hear timbre, and it can't feel
whether a sensor is actually connected to the thing being tested. I want to
keep treating contradicting evidence, however it arrives, as a reason to
re-examine the test before the conclusion, and to keep failed hypotheses in
the record rather than deleting them once superseded — they're what makes
the eventual correction legible.
