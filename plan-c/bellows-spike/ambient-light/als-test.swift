// Experiment C: is the ambient-light sensor reachable as a standard,
// matchable IOHIDDevice (the same way the lid-orientation node is), using
// the documented HID Sensor usage-page/usage pair for "Light: Ambient
// Light" (UsagePage 0x20, Usage 0x41)?
//
// Read-only `ioreg -l` inspection already showed a node named "als" (plus
// "als-temp") of class AppleSPUHIDInterface, living under the same
// Always-On-Processor (AOP) sensor-hub subsystem as the "accel"/"gyro"
// nodes checked in ../accel-gyro/ -- with no VendorID/ProductID of its own,
// i.e. not modeled as a normal IOHIDDevice. This script checks the
// standard public path directly rather than assuming that's conclusive.
//
// Run: swift plan-c/bellows-spike/ambient-light/als-test.swift

import Foundation
import IOKit.hid

let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
let matching: [String: Any] = [
    kIOHIDDeviceUsagePageKey as String: 0x20,
    kIOHIDDeviceUsageKey as String: 0x41, // HID Sensor page, "Light: Ambient Light"
]
IOHIDManagerSetDeviceMatching(manager, matching as CFDictionary)
let openResult = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
print("IOHIDManagerOpen result: \(openResult) (0 = success)")

guard let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>, !devices.isEmpty else {
    print("")
    print("ALS TEST")
    print("")
    print("RESULT: no HID device matched UsagePage=0x20 Usage=0x41 (Ambient Light).")
    print("Consistent with `ioreg -l`, which shows an \"als\" node of class")
    print("AppleSPUHIDInterface under the Always-On-Processor sensor-hub subsystem,")
    print("with no VendorID/ProductID of its own -- it is not exposed as a standard")
    print("matchable IOHIDDevice the way the lid-orientation sensor is.")
    exit(0)
}

print("Matched \(devices.count) ALS device(s) -- polling for 15s at 2Hz.")
print("Vary room light during this window (cover the camera/sensor area, turn a light on/off).")
let device = devices.first!
var previous: Int? = nil
for _ in 0..<30 {
    var buffer = [UInt8](repeating: 0, count: 8)
    var length = 8
    let result = buffer.withUnsafeMutableBufferPointer { ptr -> IOReturn in
        IOHIDDeviceGetReport(device, kIOHIDReportTypeFeature, 0, ptr.baseAddress!, &length)
    }
    if result == kIOReturnSuccess, length >= 2 {
        let raw = Int(buffer[0]) | (Int(buffer[1]) << 8)
        let delta = previous.map { raw - $0 } ?? 0
        print("ALS TEST\n\nlux/raw:\n\(raw)\n\ndelta:\n\(delta >= 0 ? "+" : "")\(delta)\n")
        previous = raw
    }
    Thread.sleep(forTimeInterval: 0.5)
}
