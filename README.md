# PawMemo

React 宠物对话与记忆 Demo，附独立 iOS 模拟器应用壳。页面支持文字/语音草稿、可追溯记忆及原位纠正、头像与多宠物资料。本地存储按宠物隔离，历史原文和回答引用保留版本。

## 启动

在项目根目录执行：

```sh
npm run build
npm run preview
```

打开 [本机预览](http://127.0.0.1:5181/)。构建输出位于 `.pawmemo/build`，预览只监听本机。**5181 已运行时无需重复启动**；不要为更新页面丢弃尚未保存的输入。新环境先运行 `npm ci`（需要支持 `--env-file-if-exists` 的 Node.js 版本，建议 Node.js 22.12+）。

外部模型由服务端读取本机 `.env` 配置。需要接入时，复制 `.env.example` 为 `.env`，填写服务地址、模型、密钥及对应价格，并设置 `EXTERNAL_AI_ENABLED=true`；默认关闭外部调用。前端不包含密钥，实际配置及本地预算记录不会提交到仓库。`npm run dev` 只启动前端热更新，不能代替同源 API 预览服务。

## iOS 模拟器

Xcode 打开 [PawMemoSimulator.xcodeproj](ios/PawMemoSimulator.xcodeproj)，选择 **PawMemoSimulator** scheme 与 iPhone 模拟器，点 **Run**。详见 [iOS 说明](ios/README.md)。这是连接上述本机服务的 WKWebView 开发壳，网页/API 没有离线打包，App 资料与 Safari/Chrome 独立。手机局域网入口当前暂停。

## 测试

```sh
npm test
npm run test:server
npm run test:budget
npm run test:browser
```

默认测试使用合成数据和隔离服务，不调用真实 AI/ASR。浏览器测试自动启动禁外呼的临时服务，不依赖退休的固定端口。结果输出在 `.pawmemo/test-results`，详见 [测试说明](tests/README.md)。

## 目录

- `src/` 当前页面、录音、资料及本地数据模型。
- `server/` 本机 API、持久费用保护；手机网关代码保留但不自动启动。
- `public/` 当前页面资源。
- `tests/` 当前回归用例与录制模型样本。
- `ios/` 可在 Xcode Run 的模拟器项目。

当前已知限制包括：录制模型样本不能证明所有新文本都整理正确；未保存的本页草稿刷新前需保存；HEIC 暂不支持。
