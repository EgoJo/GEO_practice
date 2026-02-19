# GEO 智能体（Agent + MCP 架构）

基于《基于 Agent + MCP 架构的 GEO 智能体技术方案 (v2.0)》实现的闭环系统：通过 **Agent + MCP** 自动完成 **审计 → 诊断 → 优化 → 结构化 → 发布**，提升内容在 AI 搜索（Perplexity、SearchGPT、Google AI Overview 等）中的可见性。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent 决策中枢 (Claude / Cursor 等)                               │
│  + GEO 策略 System Prompt                                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ MCP Protocol (stdio)
┌───────────────────────────▼─────────────────────────────────────┐
│  GEO MCP Server (本仓库)                                          │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐   │
│  │ AI-Search-   │ Content-     │ Schema-      │ CMS-Bridge   │   │
│  │ Audit        │ Reader       │ Generator   │              │   │
│  │ (Tavily API) │ (Playwright) │ (JSON-LD)   │ (WP REST)    │   │
│  └──────────────┴──────────────┴──────────────┴──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 工具说明（你可以做什么）

- **ai-search-audit**：输入一个目标关键词，查看 AI 搜索目前都在引用谁、说了什么。
- **content-reader**：抓取你的网站页面，提取标题、结构和正文（Markdown），方便对比和改写。
- **schema-generator**：根据关键信息生成一段 Schema.org JSON-LD（如 Article）。
- **cms-bridge**：在已配置 WordPress 的前提下，一键更新指定文章/页面的标题、正文和摘要。

## 环境要求

- **Node.js** >= 18
- 可选：**Tavily API Key**（[tavily.com](https://tavily.com)）
- 可选：**WordPress** 站点 + Application Password（使用 cms-bridge 时）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

首次使用 **content-reader** 前需安装 Playwright 浏览器：

```bash
npx playwright install chromium
```

### 2. 配置环境变量（可选，支持交互写入）

```bash
cp .env.example .env    # 若文件已存在可跳过
```

> 提示：如果你没先手动填 `TAVILY_API_KEY`，在运行第 3 步时，程序会在终端里提示你输入 Tavily 的 API Key，并自动写入 `.env`，以后就不用再配了。

### 3. 一句命令，交互式优化网站

```bash
npm run geo
```

按终端提示一步步输入：关键词 → 页面 URL → 是否生成 JSON-LD →（可选）是否发布到 WordPress。

### 4. 作为 MCP Server 给 Cursor/Claude 使用

```bash
npm run mcp
# 或
npx tsx src/index.ts
```

进程通过 **stdin/stdout** 与 MCP 客户端通信（JSON-RPC），供 Claude Desktop、Cursor 等调用。单独运行不会在终端打印内容，需要由 Cursor 等客户端发起调用才有返回。

### 5. 在 Cursor 中配置 MCP

在 Cursor 的 MCP 配置（如 `~/.cursor/mcp.json` 或项目级配置）中增加：

```json
{
  "mcpServers": {
    "geo-agent": {
      "command": "node",
      "args": ["/绝对路径/GEO_practice/dist/index.js"],
      "env": {
        "TAVILY_API_KEY": "你的 Tavily Key",
        "WORDPRESS_URL": "https://yoursite.com",
        "WORDPRESS_USER": "wp_user",
        "WORDPRESS_APP_PASSWORD": "xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

若直接跑 TypeScript：

```json
{
  "mcpServers": {
    "geo-agent": {
      "command": "npx",
      "args": ["tsx", "/绝对路径/GEO_practice/src/index.ts"],
      "env": { ... }
    }
  }
}
```

### 6. GEO Agent 系统提示词

在 Agent 宿主（如 Cursor 的 Custom Instructions 或 Claude 的系统提示）中可使用本仓库提供的 GEO 策略提示词，使模型按「审计 → 诊断 → 优化 → Schema → 发布」流程调用上述工具。提示词内容见：

**`src/agent/geo-system-prompt.ts`**

## 项目结构

```
GEO_practice/
├── src/
│   ├── index.ts              # MCP Server 入口（stdio JSON-RPC）
│   ├── lib/
│   │   └── env.ts            # 环境变量
│   ├── tools/
│   │   ├── ai-search-audit.ts
│   │   ├── content-reader.ts
│   │   ├── schema-generator.ts
│   │   └── cms-bridge.ts
│   └── agent/
│       └── geo-system-prompt.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

构建：`npm run build`，开发运行：`npm run dev`（同 `npm run mcp`）。
