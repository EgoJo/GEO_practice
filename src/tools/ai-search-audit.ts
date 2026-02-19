/**
 * AI-Search-Audit Tool
 * 集成 Tavily AI / Brave Search API，模拟 AI 搜索过程，
 * 返回当前被引用的内容摘要、来源域名及核心观点。
 */

import { z } from "zod";
import { env, requireTavily } from "../lib/env.js";

const inputSchema = z.object({
  /** 要审计的目标关键词或查询（如 Perplexity/SearchGPT 中用户会输入的句子） */
  query: z.string().describe("目标关键词或自然语言搜索查询"),
  /** 最多返回的结果数量，默认 10 */
  maxResults: z.number().min(1).max(20).optional().default(10),
  /** 搜索深度：basic | advanced */
  searchDepth: z.enum(["basic", "advanced"]).optional().default("advanced"),
});

export type AISearchAuditInput = z.infer<typeof inputSchema>;

export const aiSearchAuditDef = {
  name: "ai-search-audit" as const,
  title: "AI Search Audit",
  description:
    "模拟 AI 搜索引擎（如 Perplexity、SearchGPT）的检索过程，返回当前被引用的内容摘要、来源域名及核心观点，用于 GEO 现状分析与竞品对比。",
  inputSchema,
};

export async function runAISearchAudit(
  input: AISearchAuditInput
): Promise<{ content: string; results: Array<{ title: string; url: string; snippet: string; score?: number }> }> {
  const apiKey = env.TAVILY_API_KEY ?? requireTavily();

  const body: Record<string, unknown> = {
    api_key: apiKey,
    query: input.query,
    search_depth: input.searchDepth,
    max_results: input.maxResults,
    include_answer: true,
    include_raw_content: false,
  };

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tavily API 错误 (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
    }>;
  };

  const results = (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
    score: r.score,
  }));

  const lines: string[] = [];
  if (data.answer) {
    lines.push("## AI 摘要\n" + data.answer);
  }
  lines.push("\n## 被引用来源与摘要\n");
  results.forEach((r, i) => {
    lines.push(`### ${i + 1}. ${r.title}`);
    lines.push(`- URL: ${r.url}`);
    if (r.score != null) lines.push(`- 相关度: ${r.score}`);
    lines.push(`- 摘要: ${r.snippet}`);
    lines.push("");
  });

  return {
    content: lines.join("\n"),
    results,
  };
}
