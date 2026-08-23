// Plan C technical spike: diagnose whether this Mac's HID lid-angle sensor
// node tracks real hinge movement, or is only a static/inert register.
//
// Background: several open-source projects (e.g. samhenrigold/LidAngleSensor)
// have reverse-engineered a lid-angle HID node on MacBook Pro 14"/16"
// (2021+) at VendorID 0x05AC, ProductID 0x8104, HID UsagePage 0x20 (32),
// Usage 0x8A (138). This script checks whether that node exists here, what
// its actual HID elements are, and whether any of them change value when the
// lid is physically moved.
//
// Run: swift plan-c/investigation/lid-angle-diagnostic.swift
// You must physically move the lid while this runs -- it cannot simulate
// hinge movement.

import Foundation
import IOKit.hid

func log(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }

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
    log("RESULT: no device matched VendorID=0x05AC ProductID=0x8104 UsagePage=0x20 Usage=0x8A")
    log("This Mac does not expose the known lid-angle HID node under this identity.")
    exit(1)
}
log("Matched device: \(device)")

guard let elements = IOHIDDeviceCopyMatchingElements(device, nil, IOOptionBits(kIOHIDOptionsTypeNone)) as? [IOHIDElement] else {
    log("RESULT: device matched but no HID elements could be enumerated")
    exit(1)
}
log("Element count: \(elements.count)")
for el in elements {
    let rid = IOHIDElementGetReportID(el)
    let usage = IOHIDElementGetUsage(el)
    let type = IOHIDElementGetType(el)
    let min = IOHIDElementGetLogicalMin(el)
    let max = IOHIDElementGetLogicalMax(el)
    log("  reportID=\(rid) usage=\(usage) type=\(type.rawValue) range=[\(min),\(max)]")
}

// The element with usage 1151, reportID 1, range [0,360] is the only
// plausible "angle in whole degrees" field found by enumeration -- read it
// as a Feature report (2 data bytes after the report-ID byte, little-endian).
log("")
log("Polling reportID=1 (candidate 0-360 degree field) for 20s at 5Hz.")
log("Physically swing the lid through its full range during this window.")

var samples: [Int] = []
for i in 0..<100 {
    var buffer = [UInt8](repeating: 0, count: 8)
    var length = 8
    let result = buffer.withUnsafeMutableBufferPointer { ptr -> IOReturn in
        IOHIDDeviceGetReport(device, kIOHIDReportTypeFeature, 1, ptr.baseAddress!, &length)
    }
    if result == kIOReturnSuccess, length >= 3 {
        let angle = Int(buffer[1]) | (Int(buffer[2]) << 8)
        samples.append(angle)
        print("t=\(String(format: "%.1f", Double(i) * 0.2))s angle=\(angle)")
        fflush(stdout)
    }
    Thread.sleep(forTimeInterval: 0.2)
}

let minSample = samples.min() ?? -1
let maxSample = samples.max() ?? -1
log("")
log("Observed range over the window: \(minSample) .. \(maxSample) (span \(maxSample - minSample))")
if maxSample - minSample <= 2 {
    log("RESULT: value did not track physical lid movement (span <= 2, i.e. noise only).")
    log("The HID node exists and matches the known fingerprint, but on this hardware")
    log("it returns a static/stale value rather than a live hinge reading.")
} else {
    log("RESULT: value tracked physical movement (span > 2) -- looks viable.")
}
