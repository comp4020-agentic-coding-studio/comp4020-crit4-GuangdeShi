// Plan C technical spike, iteration 2: does explicitly enabling the HID
// "reporting state" element (reportID 5, range [0,2], observed at 0) make
// the candidate lid-angle field (reportID 1, range [0,360]) go live?
//
// This builds directly on plan-c/investigation/lid-angle-diagnostic.swift's
// element enumeration -- it does not re-discover anything, it just tries
// the one remaining plausible lever before concluding the sensor is inert
// on this machine. See FINDINGS.md for the full background.
//
// Run: swift plan-c/investigation/lid-angle-enable-test.swift
// You must physically move the lid during Step 4 -- it cannot simulate
// hinge movement.

import Foundation
import IOKit.hid

func log(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }

func readFeatureReport(_ device: IOHIDDevice, _ reportID: Int, _ size: Int = 8) -> (IOReturn, [UInt8]) {
    var buffer = [UInt8](repeating: 0, count: size)
    var length = size
    let result = buffer.withUnsafeMutableBufferPointer { ptr -> IOReturn in
        IOHIDDeviceGetReport(device, kIOHIDReportTypeFeature, CFIndex(reportID), ptr.baseAddress!, &length)
    }
    return (result, Array(buffer.prefix(length)))
}

func hex(_ bytes: [UInt8]) -> String { bytes.map { String(format: "%02x", $0) }.joined(separator: " ") }

let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
let matching: [String: Any] = [
    kIOHIDVendorIDKey as String: 0x05AC,
    kIOHIDProductIDKey as String: 0x8104,
    kIOHIDPrimaryUsagePageKey as String: 0x20,
    kIOHIDPrimaryUsageKey as String: 0x8A,
]
IOHIDManagerSetDeviceMatching(manager, matching as CFDictionary)
let openResult = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
log("IOHIDManagerOpen result: \(openResult) (0 = success)")

guard let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>, let device = devices.first else {
    log("RESULT: no device matched. Nothing to enable.")
    exit(1)
}
log("Matched device: \(device)")

// Step 2: read report 5 (reporting state, range [0,2]) before touching anything.
log("")
log("Step 2: reading reportID=5 (reporting state) before any write.")
let (readResult0, bytes0) = readFeatureReport(device, 5)
log("  GetReport(5) -> \(readResult0) bytes=[\(hex(bytes0))]")

// Step 3: try to enable it. Report layout observed elsewhere on this device
// is [reportID byte, value byte, ...], so write [0x05, 0x01].
log("")
log("Step 3: attempting to enable reporting.")

func setFeatureReport(_ device: IOHIDDevice, _ reportID: Int, _ value: UInt8) -> IOReturn {
    var buffer: [UInt8] = [UInt8(reportID), value]
    return buffer.withUnsafeMutableBufferPointer { ptr -> IOReturn in
        IOHIDDeviceSetReport(device, kIOHIDReportTypeFeature, CFIndex(reportID), ptr.baseAddress!, ptr.count)
    }
}

func tryEnableValue(_ device: IOHIDDevice, _ value: UInt8) -> Bool {
    log("  SetReport(5, value=\(value)): writing bytes=[05 \(String(format: "%02x", value))]")
    let setResult = setFeatureReport(device, 5, value)
    log("    IOReturn=\(setResult)")
    let (readResult, bytes) = readFeatureReport(device, 5)
    log("    read back -> \(readResult) bytes=[\(hex(bytes))]")
    let readBack = bytes.count >= 2 ? bytes[1] : 0xFF
    let ok = setResult == kIOReturnSuccess && readBack == value
    log("    enabled as \(value)? \(ok)")
    return ok
}

var enabledValue: UInt8? = nil
if tryEnableValue(device, 1) {
    enabledValue = 1
} else {
    log("  value=1 (\"All Events\") did not stick; trying value=2 (\"Threshold Events\") once.")
    if tryEnableValue(device, 2) {
        enabledValue = 2
    }
}
log("  final enable state: \(enabledValue.map { "value=\($0)" } ?? "NOT ENABLED (writes had no effect)")")

// Step 4: immediately re-test the candidate angle field regardless of
// whether the enable "stuck" by read-back, in case the write still changed
// live behavior even if GetReport echoes something else.
log("")
log("Step 4: polling reportID=1 (candidate angle) at ~15Hz for 20s.")
log("Physically swing the lid through its full range now.")

var samples: [Int] = []
var lastPrinted: Int? = nil
let sampleCount = 300
let interval = 20.0 / Double(sampleCount)
for _ in 0..<sampleCount {
    let (result, bytes) = readFeatureReport(device, 1)
    if result == kIOReturnSuccess, bytes.count >= 3 {
        let angle = Int(bytes[1]) | (Int(bytes[2]) << 8)
        samples.append(angle)
        if angle != lastPrinted {
            print("angle=\(angle)")
            fflush(stdout)
            lastPrinted = angle
        }
    }
    Thread.sleep(forTimeInterval: interval)
}

let minSample = samples.min() ?? -1
let maxSample = samples.max() ?? -1
let span = maxSample - minSample
log("")
log("Observed range: \(minSample) .. \(maxSample) (span \(span))")
if span > 2 {
    log("RESULT: SENSOR ENABLE SUCCESS -- value tracked physical movement.")
} else {
    log("RESULT: still no movement correlation (span <= 2, noise only).")
}

// Restore the reporting-state register to what we found it at, best-effort.
if let enabled = enabledValue {
    log("")
    log("Restoring reportID=5 to its original observed value (0).")
    let restoreResult = setFeatureReport(device, 5, 0)
    log("  SetReport(5, value=0) -> \(restoreResult) (was set to \(enabled) for this test)")
}
