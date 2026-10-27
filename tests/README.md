# 当前回归测试

`npm test` 保留数据迁移/存储保护、记忆版本与引用、请求与上下文、头像格式与体积等单元/接口测试。真实模型测试 `provider.live.test.mjs` 默认跳过；没有额外授权时不要开启其门禁或重放历史真实调用。

`npm run test:server` 与 `npm run test:budget` 使用注入上游和临时合成账本，不接触真实预算。先 `npm run build`。

`npm run test:browser` 自动启动外呼关闭的临时本机服务，运行：

- `memory-inline.mjs` 逐条保存/取消、版本冲突、跨宠草稿、失败恢复与窄屏。
- `voice-home.mjs` / `voice-chat.mjs` 合成麦克风、真实录音/WAV链、取消/迟到/权限失败与输入。
- `photo-input.mjs` 格式/空MIME/尺寸/压缩/准确错误。
- `profile-photo.mjs` 直接采用、整份保存取消、迟到解码与字段保护。
- `ui-copy.mjs` 文案分隔与用户原文标点保持。
- `partial-extraction.mjs` 明确事实先保存及打标签、独立追问、后续澄清和宠物切换图标对齐。

浏览器接口由夹具拦截；服务端也关闭外呼。测试输出归 `.pawmemo/test-results`，不会生成新的历史审计目录。可用 `PAWMEMO_BROWSER_CASES=photo-input,profile-photo npm run test:browser` 选择受影响的组。

`partial-extraction-live.mjs` 是独立的真实模型小样本验收，默认不运行。需另行批准调用次数与费用，显式设置 `PAWMEMO_PARTIAL_LIVE=1` 后才会读取本机配置和沿用预算账本；只使用虚构文本。报告区分语义判定、结构校验和连接失败，不以浏览器夹具代替模型质量结论。

`fixtures/memory-model-results.json` 是已获授权的两次历史真实模型输出的逐字副本，只供下游持久化/编辑回归，不是新的语义评测或“全模型通过”证明。

iOS 原生、实际WKWebView与UI测试在 `ios/`，运行方法见 `ios/README.md`。
