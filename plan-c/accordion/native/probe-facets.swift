// Diagnostic: the installed LidAngleSensor.app (release tag 1.1) matches
// HID devices with a dictionary containing the literal string keys
// "UsagePage" / "Usage" -- NOT kIOHIDPrimaryUsagePageKey ("PrimaryUsagePage")
// and not kIOHIDDeviceUsagePageKey ("DeviceUsagePage"). Those are not
// recognized IOHIDManager matching-dictionary keys, so they are silently
// ignored, and the effective match is just VendorID=0x05AC/ProductID=0x8104
// -- which can match MULTIPLE separate IOHIDDevice facets of the same
// composite device (we already saw evidence of multiple facets in the
// earlier accel-gyro broad scan). Our own reader, lid-angle-rs, and current
// GitHub `main` all match strictly on PrimaryUsagePage=0x20/PrimaryUsage=0x8A,
// which picks out exactly one specific facet.
//
// This script enumerates every facet matching just VendorID+ProductID,
// prints each one's primary usage page/usage, and polls Feature report 1 on
// ALL of them in parallel so we can see if a different facet (not the one
// we've been reading) is the one that actually updates live.
//
// Run: swift plan-c/accordion/native/probe-facets.swift

import Foundation
import IOKit.hid

let noOptions = IOOptionBits(kIOHIDOptionsTypeNone)
let manager = IOHIDManagerCreate(kCFAllocatorDefault, noOptions)
let matching: [String: Any] = [
    kIOHIDVendorIDKey as String: 0x05AC,
    kIOHIDProductIDKey as String: 0x8104,
]
IOHIDManagerSetDeviceMatching(manager, matching as CFDictionary)
guard IOHIDManagerOpen(manager, noOptions) == kIOReturnSuccess else {
    print("failed to open manager"); exit(1)
}
guard let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>, !devices.isEmpty else {
    print("no devices matched VendorID=0x05AC ProductID=0x8104 at all"); exit(1)
}

print("Found \(devices.count) facet(s) of VendorID=0x05AC/ProductID=0x8104:\n")

struct Facet {
    let index: Int
    let device: IOHIDDevice
    let primaryUsagePage: Int
    let primaryUsage: Int
}

var facets: [Facet] = []
for (i, device) in devices.enumerated() {
    let pup = IOHIDDeviceGetProperty(device, kIOHIDPrimaryUsagePageKey as CFString) as? Int ?? -1
    let pu = IOHIDDeviceGetProperty(device, kIOHIDPrimaryUsageKey as CFString) as? Int ?? -1
    print("facet[\(i)]: primaryUsagePage=\(pup) primaryUsage=\(pu)")
    guard IOHIDDeviceOpen(device, noOptions) == kIOReturnSuccess else {
        print("  -> failed to open")
        continue
    }
    facets.append(Facet(index: i, device: device, primaryUsagePage: pup, primaryUsage: pu))
}
print("")
print("Opened \(facets.count) facet(s). Polling Feature report ID 1 on ALL of them for 20s.")
print("Physically move the lid during this window.\n")

for i in 0..<40 {
    var line = "t=\(String(format: "%.1f", Double(i) * 0.5))s  "
    for facet in facets {
        var report = [UInt8](repeating: 0, count: 8)
        var length = CFIndex(report.count)
        let result = IOHIDDeviceGetReport(facet.device, kIOHIDReportTypeFeature, 1, &report, &length)
        if result == kIOReturnSuccess, length >= 3 {
            let raw = Int(report[1]) | (Int(report[2]) << 8)
            line += "facet[\(facet.index)](page=\(facet.primaryUsagePage),usage=\(facet.primaryUsage))=\(raw)  "
        } else {
            line += "facet[\(facet.index)]=err(\(result))  "
        }
    }
    print(line)
    fflush(stdout)
    Thread.sleep(forTimeInterval: 0.5)
}
