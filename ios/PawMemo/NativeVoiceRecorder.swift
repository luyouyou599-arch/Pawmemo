import AVFoundation
import UIKit
import WebKit

/// Only the trusted local main frame may start a user-authorized native recording.
@MainActor
final class NativeVoiceRecorder: NSObject, WKScriptMessageHandlerWithReply {
    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?
    private var requestID: String?
    private var sessionActive = false

    override init() {
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted),
            name: AVAudioSession.interruptionNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted),
            name: UIApplication.didEnterBackgroundNotification, object: nil)
    }

    @objc private func interrupted() { cancel() }

    func cancel() {
        requestID = nil
        recorder?.stop(); recorder = nil
        if let recordingURL { try? FileManager.default.removeItem(at: recordingURL) }
        recordingURL = nil
        if sessionActive {
            sessionActive = false
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    func userContentController(_ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        guard LocalOrigin.canPromptMicrophone(scheme: origin.protocol, host: origin.host,
            port: origin.port, frameURL: message.frameInfo.request.url,
            mainFrame: message.frameInfo.isMainFrame, type: .microphone),
            let body = message.body as? [String: String], let id = body["id"],
            !id.isEmpty, id.count <= 80, let action = body["action"] else {
            replyHandler(nil, "录音请求来源无效。"); return
        }
        Task { @MainActor in
            do {
                switch action {
                case "start":
                    try await start(id: id); replyHandler(["ready": true], nil)
                case "cancel":
                    if requestID == id { cancel() }
                    replyHandler(["cancelled": true], nil)
                case "stop":
                    guard requestID == id, let recorder, let url = recordingURL else {
                        throw failure("录音已结束，请重新录音。")
                    }
                    recorder.stop()
                    defer { cancel() }
                    let wav = try Self.readWave(url)
                    replyHandler(["base64": wav.base64EncodedString()], nil)
                default: throw failure("录音操作无效。")
                }
            } catch {
                if requestID == id { cancel() }
                replyHandler(nil, (error as NSError).domain == "PawMemoVoice"
                    ? error.localizedDescription : "麦克风录音失败，请检查麦克风权限后重试。")
            }
        }
    }

    private func failure(_ text: String) -> NSError {
        NSError(domain: "PawMemoVoice", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
    }

    private func start(id: String) async throws {
        cancel(); requestID = id
        let allowed = await AVAudioApplication.requestRecordPermission()
        guard requestID == id else { throw failure("录音已取消。") }
        guard allowed else { throw failure("无法使用麦克风，请在系统设置中允许录音。") }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement)
        try session.setActive(true)
        sessionActive = true
        guard session.isInputAvailable else { throw failure("没有可用的麦克风，请检查输入设备。") }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("pawmemo-voice-\(UUID().uuidString).wav")
        recordingURL = url
        let capture = try AVAudioRecorder(url: url, settings: [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 16000,
            AVNumberOfChannelsKey: 1, AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false
        ])
        recorder = capture
        guard capture.prepareToRecord(), capture.record(forDuration: 120) else {
            throw failure("麦克风未能开始收音，请重新录音。")
        }
    }

    /// Normalize optional RIFF chunks without decoding or resampling native PCM.
    static func readWave(_ url: URL) throws -> Data {
        let raw = try Data(contentsOf: url)
        func invalid() -> NSError { NSError(domain: "PawMemoVoice", code: 2,
            userInfo: [NSLocalizedDescriptionKey: "录音为空或格式无法读取，请重新录音。"]) }
        guard raw.count >= 44, raw.count <= 10 * 1024 * 1024 else { throw invalid() }
        func word(_ at: Int) -> String { String(data: raw[at..<at+4], encoding: .ascii) ?? "" }
        func short(_ at: Int) -> Int { Int(raw[at]) | Int(raw[at+1]) << 8 }
        func long(_ at: Int) -> Int { short(at) | short(at+2) << 16 }
        guard word(0) == "RIFF", word(8) == "WAVE", long(4) + 8 == raw.count else { throw invalid() }
        var offset = 12, validFormat = false, pcm: Data?
        while offset + 8 <= raw.count {
            let size = long(offset + 4), start = offset + 8
            guard size <= raw.count - start else { throw invalid() }
            switch word(offset) {
            case "fmt ":
                guard size >= 16, short(start) == 1, short(start+2) == 1,
                    long(start+4) == 16000, long(start+8) == 32000,
                    short(start+12) == 2, short(start+14) == 16 else { throw invalid() }
                validFormat = true
            case "data":
                guard pcm == nil else { throw invalid() }
                pcm = raw.subdata(in: start..<start+size)
            default: break
            }
            offset = start + size + size % 2
        }
        guard validFormat, let pcm, !pcm.isEmpty, pcm.count % 2 == 0,
            pcm.count <= 120 * 32000 else { throw invalid() }
        var data = Data()
        func appendWord(_ value: String) { data.append(contentsOf: value.utf8) }
        func appendShort(_ value: UInt16) { var v = value.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }
        func appendLong(_ value: UInt32) { var v = value.littleEndian; withUnsafeBytes(of: &v) { data.append(contentsOf: $0) } }
        appendWord("RIFF"); appendLong(UInt32(36 + pcm.count)); appendWord("WAVEfmt "); appendLong(16)
        appendShort(1); appendShort(1); appendLong(16000); appendLong(32000); appendShort(2); appendShort(16)
        appendWord("data"); appendLong(UInt32(pcm.count)); data.append(pcm)
        return data
    }
}
