# FlowMosaic · AI 业务梳理画布

把混乱的业务描述（PRD、需求文档、会议纪要、聊天记录）丢进去，AI 自动提取**角色、步骤、判断分支、业务状态**，渲染成可交互、可拖拽的流程画布，并支持**对话式调整**和 **Mermaid 导出**。

## 特性

- 🧠 **AI 结构化解析**：基于 OpenAI 兼容接口，自动抽取流程主干（节点 5~25 个，拒绝碎片化）
- 🎨 **交互式画布**：React Flow 渲染，节点按类型着色（起点/步骤/判断/状态/角色/终点），自由拖拽
- 💬 **对话式梳理**：像聊天一样修改流程图 ——「把退款环节单独展开」「增加一个风控审核环节」
- 📤 **一键导出**：复制 / 下载 Mermaid 代码，直接贴进语雀、Notion、GitHub README
- 🔒 **隐私友好**：API Key 和数据仅保存在浏览器本地 localStorage，无任何服务端
- 🔌 **模型自由**：支持任意 OpenAI 兼容 API（DeepSeek、Moonshot、通义、OpenAI……）

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:5173 ，点右上角「⚙ 模型设置」：

1. 点击服务商预设（DeepSeek / 智谱 GLM / Kimi / 通义千问 / OpenAI），或手动填写
2. 填写你的 API Key
3. 请求方式保持「自动」即可

然后在左侧粘贴业务描述（可点击内置示例体验），点击「开始梳理」。

## 关于智谱 GLM 等「不支持浏览器直连」的服务商

部分服务商（如智谱 `open.bigmodel.cn`）的 API **不返回 CORS 响应头**，浏览器会直接拦截网页发出的请求（报 `Failed to fetch`），这与 Key 和模型名无关。BizLens 的应对方式：

- **开发模式**：`vite.config.ts` 内置了本地代理插件，设置里的请求方式选「自动」时，直连失败会自动改走 `http://localhost:5173/api/proxy`，无需任何配置。
- **生产模式**：`npm run build && npm start` 启动 `server.mjs`（静态服务 + 代理一体，默认 8080 端口）。

## 技术栈

- Vite + React 18 + TypeScript
- [@xyflow/react](https://xyflow.com/) 交互式流程画布
- 原生 fetch 调用 OpenAI 兼容 `/chat/completions` 接口（无 SDK 依赖）
- 分层自动布局（拓扑层级 + 环保护），零第三方布局库
- 内置本地 LLM 代理（Vite 插件 / Node 独立服务器两种形态），兼容不支持 CORS 的服务商

## Roadmap

- [ ] 导出 PNG / SVG / draw.io
- [ ] 泳道图视图（按角色分组）
- [ ] 多版本对比（梳理前 vs 调整后）
- [ ] 代码仓库解析（输入代码目录 → 业务调用链）
- [ ] 本地 WebGPU 推理（零 Key 使用）
- [ ] 团队协作与分享链接

## License

MIT
