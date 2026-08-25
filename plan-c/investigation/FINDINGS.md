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

## Iteration 2: explicitly enabling reporting (reportID 5)

`lid-angle-enable-test.swift` tried the one remaining plausible lever: the
correct reporting-state element this time (reportID 5, usage 1156, range
`[0,2]`, observed at `0`), rather than the wrong report targeted in the
first pass.

1. **Step 2 — read before touching anything**: `GetReport(5)` →
   `kIOReturnSuccess`, bytes `[05 00]`. Confirms the `0`/disabled value from
   the first investigation.
2. **Step 3 — attempt to enable**: `SetReport(5, value=1)` (write
   `[05 01]`) returned `IOReturn -536870201` = `0xE00002C7` =
   **`kIOReturnUnsupported`**. Read-back afterwards still showed `[05 00]`
   — the write had no effect. Tried `value=2` ("Threshold Events") once as
   a fallback: same `kIOReturnUnsupported`, same unchanged read-back.
   Neither write attempt was repeated further, per the experiment's own
   "don't spam HID writes" constraint.
3. **Step 4 — re-polled the candidate angle field anyway** (reportID 1) at
   ~15 Hz for 20 seconds while physically swinging the lid through its full
   range. Result: `122`/`123` alternating — identical ±1 noise pattern to
   the very first test, span `1`.

`kIOReturnUnsupported` is a clean, structural answer, not a permissions
error: `IOHIDDeviceSetReport` for this report shape is rejected by the
driver outright, not merely denied by a privacy/TCC gate. There is no
"grant more access and retry" path here — the collection's Feature reports
on this device do not accept writes in this layout at all. Since nothing
was successfully changed, no restore step was needed (the script checks
for this and skips the restore write when the enable attempt had no
effect).

## Smallest next experiment worth trying

- Repeat both diagnostic scripts (`lid-angle-diagnostic.swift` and
  `lid-angle-enable-test.swift`) unchanged on an actual MacBook Pro
  14"/16" (2021+), where this sensor is known to work, to confirm the
  scripts themselves are correct and that the negative result here is
  specific to the MacBook Air's hardware/firmware rather than a bug in the
  approach. This is a more productive use of time than further
  reverse-engineering register writes against a driver that has already
  answered "unsupported."
- Do not attempt further undocumented registers on this machine, and do
  not substitute a fake/simulated input for the real hinge sensor — per
  the spike's own ground rules, Plan C is blocked on this hardware class
  until it can be tried on compatible hardware.

## Verdict (superseded below — kept as process evidence, not deleted)

**PLAN C SENSOR SPIKE: NOT VIABLE ON THIS MACBOOK AIR** (Mac15,12). The
lid-angle HID node exists and can be opened/read/written without any
permission error, but its data does not reflect real hinge movement, and
the driver explicitly rejects (`kIOReturnUnsupported`) the one plausible
enable path found by element enumeration. The next meaningful experiment
is running the same diagnostics on a compatible MacBook Pro, not spending
more time reverse-engineering this MacBook Air.

## Resumed: cross-check against existing mature implementations

The "not viable" verdict above turned out to be wrong, and this section
explains why, without deleting the record above (it's real evidence of
what our own diagnostic actually observed at the time).

1. Our custom HID diagnostic (`lid-angle-diagnostic.swift`) read reportID 1
   (Feature report, VendorID `0x05AC`/ProductID `0x8104`, UsagePage
   `0x20`/Usage `0x8A`) and saw it frozen at `122`/`123` across multiple
   dedicated test windows, with the lid being swung through its full range
   on cue each time.
2. We cross-checked against two established, independent open-source lid
   angle readers: `wangfu91/lid-angle-rs` (Rust, installed via
   `cargo install lid-angle`) and `samhenrigold/LidAngleSensor` (Swift/
   SwiftUI, installed as the prebuilt notarized `.app` via
   `brew install --cask lidanglesensor`).
3. The user directly observed `LidAngleSensor.app`'s own window: the angle
   and velocity fields changed continuously and tracked real hinge
   movement live. This meant the hardware was not the blocker — the earlier
   "not viable" conclusion was wrong.
4. We then spent significant effort trying to find a *code*-level
   explanation for why the installed app's read path would differ from
   ours: comparing its exact installed version (release tag `1.1`,
   `gold.samhenri.LidAngleSensor`, notarized, hardened runtime, **empty**
   entitlements) against `main`; diffing `1.1`'s `findSensor()`/`poll()`
   against our reader's matching/parsing code (byte-for-byte identical
   Feature-report parsing: `report[1] | (report[2] << 8)`, report ID 1);
   and testing whether `1.1`'s non-standard bare `"UsagePage"`/`"Usage"`
   matching-dictionary keys (vs. our `kIOHIDPrimaryUsagePageKey`/
   `kIOHIDPrimaryUsageKey`) picked out a *different* HID facet of this
   composite VendorID/ProductID device. That last hypothesis was tested
   directly (`plan-c/accordion/native/probe-facets.swift`, matching on
   VendorID+ProductID only): only **one** of the device's 4 facets
   (usagePage `0x20`/usage `0x8A`) responds to Feature report 1 at all —
   the same one our own reader already matches. So it isn't a facet
   selection bug either.
5. The actual explanation was simpler and non-code: **our own reader
   (`plan-c/accordion/native/lid-reader.swift`), unmodified, produces
   live, correctly-tracking angle/velocity output** when run while the
   screen is genuinely being moved *during* the sampling window. Every
   earlier "frozen" result (this file's own `122`/`123` observations
   included) was captured in a window where physical lid movement was
   requested but never actually confirmed to be happening at the same
   moment the reader was sampling — a test-methodology gap, not a
   hardware or implementation defect. Once reader and physical movement
   were run at the same time and directly observed together, the reader
   swept smoothly across a real ~80°-128° range with correctly-signed
   velocity.
6. Plan C is resumed on this basis: the sensor is real and readable on
   this exact machine using a strict `kIOHIDPrimaryUsagePageKey`/
   `kIOHIDPrimaryUsageKey`-matched Feature-report poll, no code changes
   needed relative to what we already had. This reversal — including the
   false lead about facet-matching — is itself useful agentic-development
   evidence: a plausible, testable hypothesis was formed and directly
   falsified, and the true cause was a much simpler experimental-control
   gap than any of the code-level theories.

## Updated verdict

**PLAN C LID ANGLE: VIABLE.** See `plan-c/accordion/native/lid-reader.swift`
for the working minimal reader and `plan-c/accordion/native/probe-facets.swift`
for the facet-matching falsification test.
