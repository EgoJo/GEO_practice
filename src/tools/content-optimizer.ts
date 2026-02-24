/**
 * Content-Optimizer Tool
 * 使用 DeepSeek LLM，对抓取到的页面内容进行 GEO 向的重写与结构化，
 * 返回一段可直接部署的 HTML（完整文档）。
 */

import { env } from "../lib/env.js";
import { GEO_SYSTEM_PROMPT } from "../agent/geo-system-prompt.js";

export interface ContentOptimizerInput {
  keyword?: string;
  url?: string;
  page: {
    title: string;
    metaDescription: string;
    headings: Array<{ level: number; text: string }>;
    markdownPreview: string;
  };
  auditSummary?: string;
}

export interface ContentOptimizerResult {
  optimizedHtml: string;
  auditInsights?: string;
}

export async function runContentOptimizer(
  input: ContentOptimizerInput
): Promise<ContentOptimizerResult> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 DEEPSEEK_API_KEY，无法调用大模型进行优化。");
  }

  const baseUrl = env.DEEPSEEK_BASE_URL.replace(/\/$/, "");
  const model = env.DEEPSEEK_MODEL;

  const system = `${GEO_SYSTEM_PROMPT}

现在你不再调用 MCP 工具，而是直接根据给定的页面解析结果，生成一份 GEO 友好的完整 HTML5 页面。

【非常重要的约束（必须遵守）】
- 你的**主要信息来源**是 user 提供的 \`page.markdownPreview\` 与相关字段（title、metaDescription、headings）。
- \`auditSummary\` 只作为「补充参考」：可以帮助你理解这个主题在 AI 搜索中的常见模式，但**不能用审计结果完全替换原文内容**。
- 必须保留原文中的核心事实、主要故事/案例和基本结构；可以改写措辞、拆分段落、增加小标题，但不能虚构或改写原文事实，更不能添加与原文无关的新故事/数据/引用。
- 如果需要结合 AI 审计结果补充一两句观点或建议，请尽量简短，并让它们自然融入原文语境，整篇 HTML 仍应以原文内容为主体。

【输出格式要求】
需要特别标出「哪些句式/观点是参考 AI 搜索审计得出的」，请严格按照下面的输出格式返回两段内容：

1. 第一段：用中文要点列出「来自 AI 审计的关键信息」，用方括号包裹：
   [AI_AUDIT_INSIGHTS]
   - 要点 1
   - 要点 2
   ...
   [/AI_AUDIT_INSIGHTS]

2. 第二段：一份 GEO 友好的完整 HTML 文档（基于原文轻改写后得到），用方括号包裹：
   [OPTIMIZED_HTML]
   <!DOCTYPE html>
   <html>...</html>
   [/OPTIMIZED_HTML]

【HTML 结构要求】
- HTML 部分必须是**完整 HTML 文档**（包含 <!DOCTYPE html>、<html>、<head>、<body>）。
- 在 <head> 中补充合理的 <title> 与 <meta name="description">。
- 在 <body> 中以清晰的 H1/H2/H3 结构组织内容。
- 内容可以适当比原文更精炼、更有结构，但必须保持事实不虚构。
- 不需要再嵌入 JSON-LD（因为已有独立的 Schema 生成逻辑）。`;

  const userPayload = {
    keyword: input.keyword ?? null,
    url: input.url ?? null,
    auditSummary: input.auditSummary ?? null,
    page: input.page,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "下面是已抓取并解析好的页面信息，请据此生成一份 GEO 友好的完整 HTML 页面（请只返回 HTML，不要解释）：\n\n" +
            JSON.stringify(userPayload, null, 2),
        },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API 错误 (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw =
    data.choices?.[0]?.message?.content?.trim() ||
    "<!-- 模型未返回内容 -->";

  let auditInsights: string | undefined;
  let optimizedHtml = raw;

  const insightsMatch = raw.match(
    /\[AI_AUDIT_INSIGHTS\]([\s\S]*?)\[\/AI_AUDIT_INSIGHTS\]/i
  );
  if (insightsMatch) {
    auditInsights = insightsMatch[1].trim();
  }

  const htmlMatch = raw.match(
    /\[OPTIMIZED_HTML\]([\s\S]*?)\[\/OPTIMIZED_HTML\]/i
  );
  if (htmlMatch) {
    optimizedHtml = htmlMatch[1].trim();
  }

  return { optimizedHtml, auditInsights };
}

