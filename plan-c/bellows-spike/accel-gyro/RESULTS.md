# Experiment B results: accelerometer / gyroscope

## What was checked

1. **`scan-sensors.swift`** — broad `IOHIDManager` match on the standard HID
   Sensor usage page (`0x20`, the same page the lid-orientation sensor
   lives on), no vendor/product filter. Result: only the already-known
   lid-orientation device (VendorID `0x05AC`/`1452`, ProductID
   `0x8104`/`33028`) showed up. No separate accelerometer or gyro device.
2. **`scan-all-hid.swift`** — a second, completely unfiltered
   `IOHIDManagerSetDeviceMatching(manager, nil)` scan across every HID
   device on the system (17 total): keyboard/trackpad, Bluetooth module,
   headset, keyboard backlight, and a few more usage-page/usage facets of
   the same lid-sensor VendorID/ProductID. Still nothing accelerometer- or
   gyro-shaped.
3. **Read-only `ioreg -l` inspection** (no writes, just registry reading) to
   check whether the hardware exists at all, independent of the HID
   matching API. It does: there's a real IMU chip (calibration blobs
   explicitly reference model `BMI284`) exposed as two child nodes,
   `accel` and `gyro`, both of class `AppleSPUHIDInterface`, living under
   Apple's Always-On-Processor (AOP) sensor-hub subsystem alongside power/
   IOReporting telemetry (report counts, calibration tables, temperature
   compensation data) — but **neither node has a VendorID/ProductID/
   PrimaryUsage of its own**, which is exactly why they never appear to
   `IOHIDManager`: they aren't modeled as ordinary IOHIDDevice objects at
   all.

## Result

**Real accelerometer + gyroscope hardware exists on this machine, but it is
not reachable through the public HID device-matching API** — the same
route that successfully opened and read the lid-orientation sensor. It is
privately owned by the AOP/SPU sensor-hub firmware. Reading it would
require reverse-engineering a private IOKit user-client protocol talking
directly to that subsystem (undocumented selectors, message framing, etc.)
— explicitly out of scope for this small spike per the "do not spend much
time reverse-engineering" instruction.

**Rating for the comparison table: FAILED** (not a permission problem, not
a "barely responds" problem — architecturally inaccessible via any public
API without a disproportionate reverse-engineering effort).
