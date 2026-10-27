import XCTest
import WebKit
@testable import PawMemoShell

final class LocalOriginTests: XCTestCase {
    func testNavigationOnlyAllowsExactLoopbackOrigin() {
        for value in ["http://127.0.0.1:5181/", "http://127.0.0.1:5181/assets/app.js"] {
            XCTAssertTrue(LocalOrigin.allows(URL(string: value)))
        }
        for value in ["https://example.com/", "http://127.0.0.1:5182/", "http://localhost:5181/",
                      "http://user@127.0.0.1:5181/", "file:///etc/passwd", "https://127.0.0.1:5181/"] {
            XCTAssertFalse(LocalOrigin.allows(URL(string: value)))
        }
    }
    func testMicrophoneMayPromptOnlyForTrustedMainFrameAndNeverCamera() {
        func allowed(host: String = "127.0.0.1", port: Int = 5181, frame: URL? = LocalOrigin.url,
                     main: Bool = true, type: WKMediaCaptureType = .microphone) -> Bool {
            LocalOrigin.canPromptMicrophone(scheme: "http", host: host, port: port,
                                           frameURL: frame, mainFrame: main, type: type)
        }
        XCTAssertTrue(allowed())
        XCTAssertFalse(allowed(host: "evil.example")); XCTAssertFalse(allowed(port: 5182))
        XCTAssertFalse(allowed(frame: URL(string: "https://evil.example/")))
        XCTAssertFalse(allowed(main: false)); XCTAssertFalse(allowed(type: .camera))
        XCTAssertFalse(allowed(type: .cameraAndMicrophone))
    }
}
