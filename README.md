# GEO 智能体（GEO_practice）

一个用于演示「生成式引擎优化（GEO）」的完整小工程，包含：

- 实时 **AI 搜索审计**（Tavily）
- 网页抓取与结构解析（Playwright）
- Schema.org JSON-LD 生成
- 基于 DeepSeek 的内容重写与优化
- 可选的 WordPress 自动发布（CMS-Bridge）
- MCP Server 接入 Cursor / Claude

既可以作为 GEO 技术方案的 Demo，也可以直接拿来帮你优化自己的网站/页面。

---

## 1. 能力一览

- **AI 搜索审计 `ai-search-audit`**
  - 调用 Tavily API，查看某个关键词下，AI 搜索目前在引用哪些内容、怎么说的。
- **页面解析 `content-reader`**
  - 用 Playwright 抓取真实网页，提取：标题、meta 描述、H1/H2/H3 结构和正文 Markdown。
- **Schema 生成 `schema-generator`**
  - 根据实体信息生成一段 Schema.org JSON-LD（如 Article），用于 `<script type="application/ld+json">`。
- **内容优化 `content-optimizer`（DeepSeek）**
  - 把「AI 审计结果 + 页面解析结果」一起丢给 DeepSeek：
    - 提炼「来自 AI 搜索审计的关键信息」；
    - 生成一份 GEO 友好的完整 HTML 页面（优化后版本）。
- **发布 `cms-bridge`（可选）**
  - 调用 WordPress REST API，更新指定文章/页面的标题、正文、摘要等。
- **MCP Server**
  - 通过 stdio 暴露上述工具，供 Cursor / Claude 等客户端调用。

---

## 2. 环境准备

- **Node.js** >= 18
- 可选：
  - `TAVILY_API_KEY`（[tavily.com](https://tavily.com)）用于 AI 搜索审计
  - `WORDPRESS_URL` / `WORDPRESS_USER` / `WORDPRESS_APP_PASSWORD`（WordPress 自动发布时需要）
  - `DEEPSEEK_API_KEY`（DeepSeek LLM，用于内容优化）

### 安装依赖

```bash
npm install

# 首次使用 content-reader 前安装浏览器
npx playwright install chromium
```

### 配置环境变量

```bash
cp .env.example .env    # 若已存在可跳过
```

- 若你没手动配置 `TAVILY_API_KEY`，在运行 CLI 时会交互式提示你输入，并自动写入 `.env`。
- 若要启用 DeepSeek 优化，在 `.env` 中填入：

```env
DEEPSEEK_API_KEY=你的_deepseek_key
```

---

## 3. 使用方式

### 3.1 终端交互：`npm run geo`

```bash
npm run geo
```

按提示一步步输入：

- 目标关键词
- 要优化的页面 URL
- 是否生成/应用 JSON-LD
- （如已配置 WordPress）是否发布更新

适合工程师在终端里快速跑一遍完整 GEO 流程。

### 3.2 Web 可视化 Demo：`npm run web-demo`

```bash
npm run web-demo
# 浏览器打开
http://localhost:3000
```

页面结构：

- **分析现状**
  - 左：AI 搜索审计结果（Tavily 搜到的被引用内容列表）
  - 右：原页面结构（标题树 + 摘要）
- **生成结果**
  - 左：推荐 JSON-LD（Article）
  - 右：
    - 从 AI 审计中提炼出的关键信息（审计启发的要点）
    - DeepSeek 生成的「优化后 HTML 源码」
- **页面预览对比**
  - 左：原页面预览（输入的 URL）
  - 右：优化后页面预览
    - 对于校长 Demo：加载 `corgi-site-geo` 示例页
    - 其他页面：若有 LLM 生成的 HTML，则用 `srcdoc` 直接预览

这是给同事/产品/非工程同学看 GEO 效果的主入口。

### 3.3 MCP Server（给 Cursor / Claude 用）

本项目也可以作为一个 MCP Server 接入 Cursor / Claude：

```bash
# 本地启动 MCP Server（stdio）
npm run mcp
# 或直接跑 TypeScript
npx tsx src/index.ts
```

然后在 Cursor 的 MCP 配置（如 `~/.cursor/mcp.json` 或项目级配置）中新增一项 `geo-agent`，指向上述命令即可（具体 JSON 结构可按 Cursor 文档填写）。

### 3.4 GEO Agent 系统提示词

在需要自建 Agent（Cursor 自定义指令 / Claude System Prompt / LangGraph 节点）时，可以使用：

- **`src/agent/geo-system-prompt.ts`**

里面是一份完整的 GEO 策略 Prompt，包含：

- 角色：高级 GEO 专家
- Workflow：审计 → 诊断 → 优化 → Schema → 发布
- 约束：事实准确性、可读性等

---

## 4. 项目结构（简要）

```text
GEO_practice/
├── src/
│   ├── index.ts              # MCP Server 入口（stdio JSON-RPC）
│   ├── web-server.ts         # Web Demo 后端（/geo/analyze + 静态资源）
│   ├── lib/
│   │   └── env.ts            # 环境变量加载（含 Tavily / DeepSeek / WP 配置）
│   ├── tools/
│   │   ├── ai-search-audit.ts    # 调用 Tavily 做 AI 搜索审计
│   │   ├── content-reader.ts     # Playwright 抓取页面并解析结构
│   │   ├── schema-generator.ts   # 生成 Schema.org JSON-LD
│   │   ├── cms-bridge.ts         # WordPress REST API 发布/更新
│   │   └── content-optimizer.ts  # 调用 DeepSeek 生成优化后 HTML + 审计要点
│   └── agent/
│       └── geo-system-prompt.ts  # GEO 策略 System Prompt
├── public/                   # GEO Web Demo 前端单页（index.html）
├── corgi-site-before/        # 校长主页·优化前示例站点
├── corgi-site-geo/           # 校长主页·GEO 优化示例站点（静态）
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

构建：`npm run build`  
开发运行 MCP Server：`npm run dev`（等价于 `npm run mcp`）。  
