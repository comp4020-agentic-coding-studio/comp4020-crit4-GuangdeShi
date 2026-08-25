// Experiment B, step 1: broad scan for ANY HID device under the standard HID
// Sensor usage page (0x20) -- not just the already-known lid-orientation
// node (VendorID 0x05AC/0x8104, Usage 0x8A) documented in
// plan-c/investigation/FINDINGS.md. This reuses the element-enumeration
// technique that worked there, just without pre-filtering by product/usage,
// to see what else (accelerometer, gyro, ALS) might be exposed the same way.
//
// Run: swift plan-c/bellows-spike/accel-gyro/scan-sensors.swift
// Read-only: no writes, no reverse engineering beyond listing what exists.

import Foundation
import IOKit.hid

func log(_ s: String) { print(s) }

let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
let matching: [String: Any] = [kIOHIDDeviceUsagePageKey as String: 0x20]
IOHIDManagerSetDeviceMatching(manager, matching as CFDictionary)
let openResult = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
log("IOHIDManagerOpen result: \(openResult) (0 = success)")

guard let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>, !devices.isEmpty else {
    log("RESULT: no HID devices found under Sensor usage page 0x20 at all.")
    exit(0)
}
log("Found \(devices.count) device(s) under Sensor usage page 0x20:\n")

for device in devices {
    let vendorID = IOHIDDeviceGetProperty(device, kIOHIDVendorIDKey as CFString) as? Int ?? -1
    let productID = IOHIDDeviceGetProperty(device, kIOHIDProductIDKey as CFString) as? Int ?? -1
    let product = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "?"
    let primaryUsage = IOHIDDeviceGetProperty(device, kIOHIDPrimaryUsageKey as CFString) as? Int ?? -1
    log("== device: product=\"\(product)\" vendorID=\(vendorID) productID=\(productID) primaryUsage=\(primaryUsage) ==")

    guard let elements = IOHIDDeviceCopyMatchingElements(device, nil, IOOptionBits(kIOHIDOptionsTypeNone)) as? [IOHIDElement] else {
        log("  (no elements enumerable)")
        continue
    }
    for el in elements {
        let rid = IOHIDElementGetReportID(el)
        let usagePage = IOHIDElementGetUsagePage(el)
        let usage = IOHIDElementGetUsage(el)
        let type = IOHIDElementGetType(el)
        let minV = IOHIDElementGetLogicalMin(el)
        let maxV = IOHIDElementGetLogicalMax(el)
        log("  reportID=\(rid) usagePage=\(usagePage) usage=\(usage) type=\(type.rawValue) range=[\(minV),\(maxV)]")
    }
    log("")
}

log("This is a read-only listing. Nothing was written to any device.")
