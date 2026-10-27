import AppKit
let output = CommandLine.arguments[1]
let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8,
    bytesPerRow: 4096, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.setFillColor(CGColor(red: 215/255, green: 1, blue: 34/255, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
let image = NSImage(systemSymbolName: "pawprint.fill", accessibilityDescription: nil)!
let symbol = image.withSymbolConfiguration(NSImage.SymbolConfiguration(paletteColors: [.black]))!
symbol.draw(in: CGRect(x: 210, y: 210, width: 604, height: 604))
NSGraphicsContext.restoreGraphicsState()
let bitmap = NSBitmapImageRep(cgImage: context.makeImage()!)
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
