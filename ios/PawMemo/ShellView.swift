import SwiftUI
import WebKit

struct ShellView: View {
    @StateObject private var session: WebSession
    init() {
        #if DEBUG
        let store: WKWebsiteDataStore? = ProcessInfo.processInfo.arguments.contains("-PawMemoUITestEphemeral") ? .nonPersistent() : nil
        _session = StateObject(wrappedValue: WebSession(dataStore: store))
        #else
        _session = StateObject(wrappedValue: WebSession())
        #endif
    }
    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()
            WebSurface(session: session)
                .opacity(session.state == .ready ? 1 : 0)
                .allowsHitTesting(session.state == .ready)
            if session.state == .loading {
                ProgressView("正在连接 PawMemo…")
                    .accessibilityIdentifier("shell.loading")
            } else if session.state == .failed {
                VStack(spacing: 20) {
                    Image(systemName: "wifi.exclamationmark").font(.largeTitle)
                    Text("暂时连不上本机预览").font(.title2.bold())
                    Text("请在电脑上启动 PawMemo 本地服务，再重新连接。")
                        .multilineTextAlignment(.center).foregroundStyle(.secondary)
                    Text("127.0.0.1:5181").font(.callout.monospaced()).foregroundStyle(.secondary)
                    Button("重新连接") { session.reconnect() }
                        .buttonStyle(.borderedProminent).tint(.black)
                        .accessibilityIdentifier("shell.reconnect")
                }.padding(28).accessibilityIdentifier("shell.connectionError")
            }
        }
        .preferredColorScheme(.light)
        .task { session.reconnect() }
        .alert("在浏览器打开链接？", isPresented: Binding(
            get: { session.externalURL != nil },
            set: { if !$0 { session.externalURL = nil } }), presenting: session.externalURL) { url in
                Button("取消", role: .cancel) { session.externalURL = nil }
                Button("在浏览器打开") {
                    UIApplication.shared.open(url)
                    session.externalURL = nil
                }
            } message: { url in Text(url.host ?? "外部网站") }
    }
}

struct WebSurface: UIViewRepresentable {
    @ObservedObject var session: WebSession
    func makeUIView(context: Context) -> WKWebView { session.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
