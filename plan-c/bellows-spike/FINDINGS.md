# Bellows spike: comparison of candidate signals

Three tiny experiments, each asking the same question: can this signal detect
screen opening/closing well enough to drive accordion bellows? No exact hinge
angle attempted anywhere -- only STILL/OPENING/CLOSING plus a rough 0-1
intensity.

## Comparison table

| Signal              | Opening detection | Closing detection | Intensity | Stability | Pure browser? |
|---------------------|--------------------|--------------------|-----------|-----------|---------------|
| Camera              | GOOD               | GOOD               | USABLE    | USABLE    | Yes           |
| Accelerometer/Gyro  | FAILED             | FAILED             | FAILED    | FAILED    | No (native, and inaccessible even then) |
| Ambient Light       | FAILED             | FAILED             | FAILED    | FAILED    | No (native, and inaccessible even then) |

Details and raw test logs are in each experiment's own `RESULTS.md`:
[`camera/RESULTS.md`](camera/RESULTS.md),
[`accel-gyro/RESULTS.md`](accel-gyro/RESULTS.md),
[`ambient-light/RESULTS.md`](ambient-light/RESULTS.md).

## Why camera is "GOOD" for direction but only "USABLE" for intensity/stability

The row-profile shift detector is directionally reliable: across the whole
live test, a positive shift consistently meant OPENING and a negative shift
consistently meant CLOSING, with no direction flips. That's why open/close
detection itself is rated GOOD.

Intensity and stability are marked USABLE rather than GOOD because the
detector behaves like a velocity/edge detector, not a position/state
detector: fast swings produce strong, clear bursts (strength 0.8+), but slow,
steady movement produces short, weaker bursts rather than one sustained
signal for the whole movement. That's a real limitation worth being honest
about, not a blocker -- an accordion bellows signal that's stronger when you
move the screen faster is actually a reasonable mapping for "how hard are you
pushing the bellows."

## Why accelerometer/gyro and ambient light both failed the same way

Both are physically real (`ioreg -l` shows a BMI284 IMU behind `accel`/
`gyro`, and a separate `als`/`als-temp` pair), but all of them are private
`AppleSPUHIDInterface` nodes under Apple's Always-On-Processor sensor-hub
subsystem with no `VendorID`/`ProductID` of their own -- unlike the
lid-orientation sensor investigated in the previous session, which *is* a
normal matchable `IOHIDDevice`. That means there is no supported public read
path (HID or otherwise) without reverse-engineering a private IOKit
user-client protocol, which was explicitly out of scope for this spike. This
is an architectural dead end on this hardware, not a "signal is too weak"
result.

## Verdict

**BEST BELLOWS INPUT: CAMERA**
