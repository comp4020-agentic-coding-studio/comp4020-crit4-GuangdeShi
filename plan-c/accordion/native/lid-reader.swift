// Plan C accordion, phase 1: minimal native lid-angle + velocity reader.
//
// Read method is deliberately identical to the working reference
// implementation (samhenrigold/LidAngleSensor's LidAngleSensor.swift
// poll()): match VendorID 0x05AC / ProductID 0x8104 / UsagePage 0x20 /
// Usage 0x8A, open the device, and repeatedly fetch Feature report ID 1,
// parsing bytes [1] and [2] as a little-endian UInt16 raw angle in degrees.
//
// See ../../investigation/FINDINGS.md for why our earlier diagnostic in
// investigation/lid-angle-diagnostic.swift used the exact same byte
// parsing but was believed frozen -- this reader exists to settle that by
// running continuously, at the same poll rate as the working app, and
// printing every sample so it can be watched live.
//
// Run: swift plan-c/accordion/native/lid-reader.swift

import Foundation
import IOKit.hid

let noOptions = IOOptionBits(kIOHIDOptionsTypeNone)

func findDevice() -> IOHIDDevice? {
    let manager = IOHIDManagerCreate(kCFAllocatorDefault, noOptions)
    let matching: [String: Any] = [
        kIOHIDVendorIDKey as String: 0x05AC,
        kIOHIDProductIDKey as String: 0x8104,
        kIOHIDPrimaryUsagePageKey as String: 0x20,
        kIOHIDPrimaryUsageKey as String: 0x8A,
    ]
    IOHIDManagerSetDeviceMatching(manager, matching as CFDictionary)
    guard IOHIDManagerOpen(manager, noOptions) == kIOReturnSuccess else { return nil }
    guard let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>,
          let device = devices.first else { return nil }
    return device
}

guard let device = findDevice() else {
    FileHandle.standardError.write("no lid-angle HID device found\n".data(using: .utf8)!)
    exit(1)
}

guard IOHIDDeviceOpen(device, noOptions) == kIOReturnSuccess else {
    FileHandle.standardError.write("failed to open lid-angle HID device\n".data(using: .utf8)!)
    exit(1)
}

FileHandle.standardError.write("connected -- polling at 30Hz, Ctrl+C to stop\n".data(using: .utf8)!)

// Velocity: simple smoothed derivative of the raw angle, same spirit as
// LidAngleSensor.swift's updateVelocity() but stripped to the essentials
// (no movement-timeout decay yet -- that's added at the mapping stage).
let angleSmoothingFactor = 0.3
var smoothedAngle: Double? = nil
var lastAngle: Double = 0
var lastTime: TimeInterval = 0

let pollInterval: TimeInterval = 1.0 / 30.0

while true {
    var report = [UInt8](repeating: 0, count: 8)
    var length = CFIndex(report.count)
    let result = IOHIDDeviceGetReport(device, kIOHIDReportTypeFeature, 1, &report, &length)

    if result == kIOReturnSuccess, length >= 3 {
        let rawValue = UInt16(report[2]) << 8 | UInt16(report[1])
        let rawAngle = Double(rawValue)
        let now = Date().timeIntervalSince1970

        if smoothedAngle == nil {
            smoothedAngle = rawAngle
            lastAngle = rawAngle
            lastTime = now
        } else {
            smoothedAngle = angleSmoothingFactor * rawAngle + (1 - angleSmoothingFactor) * smoothedAngle!
        }

        let dt = now - lastTime
        var velocity = 0.0
        if dt > 0.001 {
            velocity = (smoothedAngle! - lastAngle) / dt
            lastAngle = smoothedAngle!
            lastTime = now
        }

        let angleStr = String(format: "%.1f", smoothedAngle!)
        let velStr = String(format: "%.1f", velocity)
        print("{\"angle\":\(angleStr),\"velocity\":\(velStr)}")
        fflush(stdout)
    }

    Thread.sleep(forTimeInterval: pollInterval)
}
