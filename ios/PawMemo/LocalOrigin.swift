import Foundation
import WebKit

/// The simulator can reach the Mac's loopback service. This is not a real-device endpoint.
enum LocalOrigin {
    static let url = URL(string: "http://127.0.0.1:5181/")!

    static func allows(_ candidate: URL?) -> Bool {
        guard let candidate else { return false }
        return candidate.scheme?.lowercased() == "http"
            && candidate.host == "127.0.0.1"
            && candidate.port == 5181
            && candidate.user == nil && candidate.password == nil
    }

    static func canPromptMicrophone(scheme: String, host: String, port: Int,
                                   frameURL: URL?, mainFrame: Bool, type: WKMediaCaptureType) -> Bool {
        scheme == "http" && host == "127.0.0.1" && port == 5181
            && mainFrame && allows(frameURL) && type == .microphone
    }
}
