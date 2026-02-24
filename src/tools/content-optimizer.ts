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

要求：
- 输出必须是**完整 HTML 文档**（包含 <!DOCTYPE html>、<html>、<head>、<body>）。
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

  const content =
    data.choices?.[0]?.message?.content?.trim() ||
    "<!-- 模型未返回内容 -->";

  return { optimizedHtml: content };
}

