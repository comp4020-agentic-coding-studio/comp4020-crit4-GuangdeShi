# Experiment C results: ambient light sensor

## What was checked

- **`als-test.swift`** — `IOHIDManager` match on the standard HID Sensor
  "Light: Ambient Light" usage (UsagePage `0x20`, Usage `0x41`). No device
  matched.
- The same read-only `ioreg -l` inspection done for
  [`../accel-gyro/RESULTS.md`](../accel-gyro/RESULTS.md) shows the ALS
  sensor follows the **identical pattern** to accel/gyro: a node named
  `als` (plus a related `als-temp`), both class `AppleSPUHIDInterface`,
  living under the same Always-On-Processor sensor-hub subsystem, with no
  VendorID/ProductID of its own. No separate legacy service (e.g. an
  `AppleLMUController`-style class from older Intel Macs) was found either.

## Result

Same conclusion as accelerometer/gyro: **the ambient-light sensor
physically exists but is privately owned by the AOP subsystem and is not
reachable through the public HID device-matching API.** No live
lux/raw/delta readings were obtainable, so no light-vs-screen-position
correlation could be tested at all — this closes off Experiment C without
needing further reverse-engineering, consistent with treating ALS as "a
possible secondary signal" that this machine simply doesn't expose
publicly.

**Rating for the comparison table: FAILED** (inaccessible, same reason as
accelerometer/gyro — not a noisy/weak signal, just no public read path).
