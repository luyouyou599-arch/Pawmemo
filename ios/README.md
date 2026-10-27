# PawMemo iOS 模拟器开发壳

用 Xcode 打开 `PawMemoSimulator.xcodeproj`，选择 **PawMemoSimulator** scheme 和 iPhone 模拟器，点 **Run**。无需签名账号、额外 SDK 或付费依赖。最低 iOS 17，仅配置模拟器平台。

应用内的 WKWebView 连接电脑上的 `http://127.0.0.1:5181/`，复用当前 React 页面。本地服务必须同时运行；网页和百炼接口没有打包成离线应用。本任务不配置真机、上架或公网。手机局域网网关保持暂停。

需要恢复网页服务时，在项目根目录执行：

```sh
npm run build
npm run preview
```

如果 5181 已运行，不要重复启动。服务关闭时，应用显示连接说明和“重新连接”；不会用白屏代替失败状态。

## 资料与权限

- App 使用自己的持久 WKWebView 资料，与 Safari、Chrome 独立。不要把 Safari 的未保存输入当作已同步到 App。
- 不包含 `.env`、CSV 密钥、预算账本或任何服务端私钥。接口继续由本机既有预算代理处理。
- 主导航只允许 `http://127.0.0.1:5181`。外部网页需要用户确认后才交给系统浏览器；其他协议、端口、子框架录音和相机网页采集不放行。
- iOS 通过仅向既定本机主页面开放的消息桥调用系统 AVAudioRecorder，录音前请求系统麦克风权限。取消、进入后台、音频中断和页面重新载入均释放录音。Device Hub 的输入需选择电脑的实际麦克风。
- iOS 直接录制 16kHz 单声道 PCM WAV，规范化文件头后调用现有识别接口，不经过 WebKit 采集、压缩音频或私有偏好。临时录音在停止或取消后删除。普通浏览器继续用 Web Audio 采集 PCM。前后端拒绝全零静音，不向 ASR 提交或计费；此检查不等于语音活动检测。
- 自动回归使用合成 WAV 或 PCM 帧，不代替真实人声的端到端验收。
- 选图继续使用网页文件输入与系统选择器，按现有表单显式保存/取消。HEIC 不宣称支持，头像仍受网页的大小和解码校验。
- 宿主使用 iOS 系统状态栏，仅在壳内隐藏网页演示用的 9:41 栏，保留原页面风格与交互。
- HTTP 仅启用本地网络 ATS 例外，未配置任意网络载入。原生导航与媒体规则继续收紧到上述单一本机来源。

## 命令行构建与测试

在项目根目录执行，设备名称可替换为本机已安装的 iPhone 模拟器：

```sh
xcodebuild -project ios/PawMemoSimulator.xcodeproj -scheme PawMemoSimulator \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -derivedDataPath /private/tmp/pawmemo-ios-shell-build CODE_SIGNING_ALLOWED=NO build
```

把最后的 `build` 改为 `test` 可运行原生来源规则、实际 WKWebView 兼容与独立 App UI 测试。UI 测试使用 Debug 专用的临时数据存储，不写入 App 正常持久档案；普通 Run 默认持久存储。测试用合成照片，不访问私人相册或 Safari 资料。
