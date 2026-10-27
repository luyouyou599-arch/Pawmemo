import Combine
import Foundation
import WebKit

@MainActor
final class WebSession: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    enum State: Equatable { case loading, ready, failed }
    @Published var state: State = .loading
    @Published var externalURL: URL?
    let webView: WKWebView
    private let nativeVoice = NativeVoiceRecorder()

    init(dataStore: WKWebsiteDataStore? = nil) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = dataStore ?? .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.userContentController.addScriptMessageHandler(nativeVoice, contentWorld: .page, name: "pawmemoAudio")
        // Keep the webpage's layout. Native iOS supplies the status bar, replacing the demo's 9:41 bar.
        let nativeStatusBar = """
        const style = document.createElement('style');
        style.textContent = '.system-bar { display: none !important; }';
        document.head.appendChild(style);
        """
        configuration.userContentController.addUserScript(WKUserScript(source: nativeStatusBar,
            injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .white
        webView.scrollView.backgroundColor = .white
        webView.allowsBackForwardNavigationGestures = false
    }

    func reconnect() {
        nativeVoice.cancel()
        state = .loading
        webView.load(URLRequest(url: LocalOrigin.url, cachePolicy: .reloadIgnoringLocalCacheData,
                                timeoutInterval: 15))
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        guard LocalOrigin.allows(url) else {
            if state == .loading { state = .failed }
            if navigationAction.targetFrame?.isMainFrame != false,
               let url, ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
               url.user == nil, url.password == nil {
                externalURL = url
            }
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame,
           let response = navigationResponse.response as? HTTPURLResponse,
           !(200...299).contains(response.statusCode) {
            state = .failed
            decisionHandler(.cancel)
        } else { decisionHandler(.allow) }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { nativeVoice.cancel() }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { state = .ready }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) { handleFailure(error) }
    private func handleFailure(_ error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { state = .failed }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { nativeVoice.cancel(); state = .failed }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        if LocalOrigin.allows(url) { webView.load(navigationAction.request) }
        else if ["http", "https"].contains(url.scheme?.lowercased() ?? ""), url.user == nil, url.password == nil {
            externalURL = url
        }
        return nil
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let allowed = LocalOrigin.canPromptMicrophone(scheme: origin.protocol, host: origin.host,
            port: origin.port, frameURL: frame.request.url, mainFrame: frame.isMainFrame, type: type)
        // .prompt preserves WebKit/system user permission. Never grant unconditionally.
        decisionHandler(allowed ? .prompt : .deny)
    }
}
