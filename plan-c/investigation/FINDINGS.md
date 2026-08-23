# Findings: real MacBook lid-angle sensor access

## Hardware / software under test

- **Model**: MacBook Air, Model Identifier `Mac15,12`, Apple M3
- **macOS**: 26.3.1 (build 25D771280a)
- **Swift**: 6.2.3 (run directly via `swift file.swift`, no Xcode project)

## API / HID path attempted

The known reverse-engineered lid-angle HID node (used by prior open-source
projects such as `samhenrigold/LidAngleSensor` on MacBook Pro 14"/16",
2021+):

- VendorID `0x05AC`, ProductID `0x8104`
- HID UsagePage `0x20` (32, the standard HID Sensor page), Usage `0x8A`
  (138, Orientation)

Confirmed present via the system's own tool before writing any code:

```
hidutil list --matching '{"VendorID":0x05AC,"ProductID":0x8104,"PrimaryUsagePage":32,"PrimaryUsage":138}'
```

This returned one matching service and one matching device
(`AppleSPUHIDDriver` / `AppleSPUHIDDevice`, `Built-In: 1`), so **the HID
service was found** — this is not a "wrong model" case in the usual sense.

## What was tried, in order

1. **`IOHIDManagerRegisterInputValueCallback`** (the normal async path for
   live HID input). `IOHIDManagerOpen` succeeded (`kIOReturnSuccess`, 1
   device matched), but zero callbacks fired over 20s of physical lid
   movement. No permission error was raised — the callback simply never
   ran.

2. **Polling `IOHIDDeviceGetReport` (Feature reports) across report IDs
   1–5**, since the HID Sensor spec often needs a feature-report enable
   before it streams. All five reads succeeded (no error), returning
   plausible-looking but *frozen* bytes — byte-for-byte identical across
   ~20s of deliberate open/close movement (see element 3 below).

3. **Enumerated the device's actual HID elements**
   (`IOHIDDeviceCopyMatchingElements`), rather than guessing report layouts.
   This was the useful step — it revealed the real per-report semantics:

   | reportID | usage | type  | range              | inferred meaning        |
   |----------|-------|-------|--------------------|--------------------------|
   | 1        | 1151  | Input | `[0, 360]`         | angle, whole degrees     |
   | 2        | 779   | Input | `[-1, 0]`          | status/error code        |
   | 3        | 775   | Input | `[0, 2147483647]`  | event counter / unique ID (this is the field that looked "plausible" but was frozen — it's `INT32_MAX`-ranged, not an angle) |
   | 4        | 771   | Input | `[0, 3]`           | power state              |
   | 5        | 1156  | Input | `[0, 2]`           | reporting state (observed value: `0`, i.e. not enabled) |
   | 7        | 1349  | Input | `[0, 36000]`       | possibly centidegrees variant |
   | 8        | 1350  | Input | `[0, 2]`           | unknown enum             |

   Report ID 1 (range `[0, 360]`) is the only field shaped like "angle in
   whole degrees", and an initial poll showed it incrementing by exactly 1
   (122 → 123) during a movement window, which looked promising.

4. **Decisive test**: polled reportID 1 at 5 Hz for 25 seconds while
   physically running the lid through hold-closed → full-open → half →
   closed. Full sample log in `lid-angle-diagnostic.swift`'s output; the
   value stayed at **122, with ±1 jitter, for the entire window**,
   regardless of the large physical swings performed on cue. Observed range
   span was 1 (123 − 122), i.e. measurement noise, not a hinge reading.

## Result

**The HID node exists, matches the known fingerprint exactly, and can be
opened and read without any permission/entitlement error — but its data
does not track real hinge movement on this machine.** It behaves like a
static/last-calibrated value rather than a live sensor.

- Permission/entitlement does **not** appear to be the issue: every open
  and read call returned `kIOReturnSuccess`; nothing was denied.
- The Mac model appears to be the limiting factor: the physical two-part
  hinge-angle sensing hardware (relative Hall-effect sensor in the base +
  accelerometer fusion in the lid) was introduced for the MacBook Pro
  14"/16" (2021+) to support lid-angle-aware display/camera behavior. The
  MacBook Air shares the embedded-controller HID descriptor (hence the
  identical VendorID/ProductID/Usage match) but does not appear to have the
  underlying physical sensing wired up — consistent with community reports
  that non-Pro and some other models expose the same HID shape without live
  data.

## Smallest next experiment worth trying

- Set reportID 5 ("reporting state", observed at `0`/disabled) to `1` via
  `IOHIDDeviceSetReport` with `kIOHIDReportTypeFeature`, then re-run the
  same poll — on the off chance the sensor is gated behind an explicit
  enable and simply wasn't asked to turn on. (Attempted once against the
  wrong report ID during investigation; not yet tried against the correct
  one.)
- Repeat this exact diagnostic on an actual MacBook Pro 14"/16" (2021+),
  where the sensor is known to work, to confirm the diagnostic script
  itself is correct and the negative result here is hardware-specific
  rather than a bug in the approach.
- If neither works, treat Plan C as blocked on this hardware class and stop
  — per the spike's own rules, do not substitute a fake input for the real
  hinge sensor.

## Verdict

**PLAN C SENSOR SPIKE: NOT YET VIABLE** (on this MacBook Air / Mac15,12).
