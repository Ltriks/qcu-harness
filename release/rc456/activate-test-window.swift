import AppKit
import Foundation
// Test-only helper. Never activate an installed/user application.
guard let id=Int32(CommandLine.arguments[1]),let app=NSRunningApplication(processIdentifier:id),let url=app.bundleURL,url.path.contains("/.work/rc456-") else {exit(2)}
let ok=app.activate(options:[.activateAllWindows,.activateIgnoringOtherApps])
Thread.sleep(forTimeInterval:0.2)
exit(ok ? 0 : 3)
