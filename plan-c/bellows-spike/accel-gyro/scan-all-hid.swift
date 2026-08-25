// Experiment B/C, step 2: one broad, unfiltered IOHIDManager enumeration
// (no usage-page/vendor/product filter at all) to check whether the
// accelerometer/gyro/ALS nodes seen in `ioreg` (as AppleSPUHIDInterface
// children named "accel"/"gyro"/"als" under the Always-On-Processor
// subsystem) also show up as ordinary matchable IOHIDDevice objects under
// some other usage page -- as opposed to only being visible as internal
// IOReporting/telemetry nodes with no VendorID/ProductID of their own.
//
// This is a single read-only scan, not a reverse-engineering session: if
// nothing new shows up here, that's the answer.
//
// Run: swift plan-c/bellows-spike/accel-gyro/scan-all-hid.swift

import Foundation
import IOKit.hid

let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
IOHIDManagerSetDeviceMatching(manager, nil) // match everything
let openResult = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
print("IOHIDManagerOpen result: \(openResult) (0 = success)")

guard let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice> else {
    print("RESULT: could not enumerate any HID devices.")
    exit(0)
}
print("Total HID devices visible to IOHIDManager: \(devices.count)\n")

for device in devices {
    let vendorID = IOHIDDeviceGetProperty(device, kIOHIDVendorIDKey as CFString) as? Int ?? -1
    let productID = IOHIDDeviceGetProperty(device, kIOHIDProductIDKey as CFString) as? Int ?? -1
    let product = IOHIDDeviceGetProperty(device, kIOHIDProductKey as CFString) as? String ?? "?"
    let usagePage = IOHIDDeviceGetProperty(device, kIOHIDPrimaryUsagePageKey as CFString) as? Int ?? -1
    let usage = IOHIDDeviceGetProperty(device, kIOHIDPrimaryUsageKey as CFString) as? Int ?? -1
    print("product=\"\(product)\" vendorID=\(vendorID) productID=\(productID) usagePage=\(usagePage) usage=\(usage)")
}
