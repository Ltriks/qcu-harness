// Render the checked-in vector geometry using native Core Graphics. No GUI.
import AppKit
import ImageIO
import UniformTypeIdentifiers

let out = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let blue = CGColor(red: 23/255, green: 79/255, blue: 145/255, alpha: 1)
let sky = CGColor(red: 154/255, green: 213/255, blue: 241/255, alpha: 1)
for size in [16, 24, 32, 48, 64, 128, 256, 512, 1024] {
    let c = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size*4,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    // macOS-style margin is reserved inside the application PNG; the mark is unchanged.
    let margin = CGFloat(size) * 0.06
    c.translateBy(x: margin, y: CGFloat(size)-margin)
    let scale = (CGFloat(size)-2*margin)/64
    c.scaleBy(x: scale, y: -scale)
    c.setFillColor(blue)
    c.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: 64, height: 64), cornerWidth: 14, cornerHeight: 14, transform: nil))
    c.fillPath()
    let gate = CGMutablePath()
    gate.move(to: CGPoint(x: 20,y:31));gate.addLine(to:CGPoint(x:20,y:20))
    gate.addCurve(to:CGPoint(x:44,y:20),control1:CGPoint(x:20,y:10),control2:CGPoint(x:44,y:10))
    gate.addLine(to:CGPoint(x:44,y:31));gate.addLine(to:CGPoint(x:38,y:31));gate.addLine(to:CGPoint(x:38,y:21))
    gate.addCurve(to:CGPoint(x:26,y:21),control1:CGPoint(x:38,y:17),control2:CGPoint(x:26,y:17))
    gate.addLine(to:CGPoint(x:26,y:31));gate.closeSubpath()
    c.setFillColor(CGColor.white);c.addPath(gate);c.fillPath()
    let book = CGMutablePath();book.move(to:CGPoint(x:12,y:37))
    book.addCurve(to:CGPoint(x:32,y:41),control1:CGPoint(x:20,y:34),control2:CGPoint(x:26,y:36))
    book.addCurve(to:CGPoint(x:52,y:37),control1:CGPoint(x:38,y:36),control2:CGPoint(x:44,y:34))
    book.addLine(to:CGPoint(x:52,y:49))
    book.addCurve(to:CGPoint(x:32,y:53),control1:CGPoint(x:44,y:46),control2:CGPoint(x:38,y:48))
    book.addCurve(to:CGPoint(x:12,y:49),control1:CGPoint(x:26,y:48),control2:CGPoint(x:20,y:46))
    book.closeSubpath();c.addPath(book);c.fillPath()
    c.setStrokeColor(blue);c.setLineWidth(2.5);c.setLineCap(.round)
    c.move(to:CGPoint(x:32,y:41));c.addLine(to:CGPoint(x:32,y:53));c.strokePath()
    c.setStrokeColor(sky);c.setLineWidth(2)
    c.move(to:CGPoint(x:16,y:42));c.addCurve(to:CGPoint(x:28,y:44),control1:CGPoint(x:21,y:41),control2:CGPoint(x:25,y:42))
    c.move(to:CGPoint(x:36,y:44));c.addCurve(to:CGPoint(x:48,y:42),control1:CGPoint(x:39,y:42),control2:CGPoint(x:43,y:41));c.strokePath()
    let url = out.appendingPathComponent("icon-\(size).png")
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest,c.makeImage()!,nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("PNG encoding failed") }
}
