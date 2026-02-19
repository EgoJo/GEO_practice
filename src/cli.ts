#!/usr/bin/env node
/**
 * GEO 智能体 - 交互式终端
 * 一句命令启动，按提示输入，一步步完成：审计 → 抓取 → 生成 Schema → 可选发布
 * 运行：npm run geo
 */

import * as readline from "readline";
import { runAISearchAudit } from "./tools/ai-search-audit.js";
import { runContentReader } from "./tools/content-reader.js";
import { runSchemaGenerator } from "./tools/schema-generator.js";
import { runCMSBridge } from "./tools/cms-bridge.js";
import { env } from "./lib/env.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve((answer ?? "").trim()));
  });
}

function print(title: string, body: string, maxLen = 1200) {
  console.log("\n" + "─".repeat(50));
  console.log("  " + title);
  console.log("─".repeat(50));
  const out = body.length > maxLen ? body.slice(0, maxLen) + "\n\n... (已截断，完整内容见上方)" : body;
  console.log(out);
  console.log("─".repeat(50) + "\n");
}

async function stepAudit(): Promise<void> {
  const keyword = await ask("1️⃣  请输入要优化的目标关键词（如：如何学习 TypeScript）：");
  if (!keyword) {
    console.log("  未输入，跳过审计。\n");
    return;
  }
  if (!env.TAVILY_API_KEY) {
    console.log("  未配置 TAVILY_API_KEY，请先在 .env 中填写后重试。跳过审计。\n");
    return;
  }
  console.log("  正在审计 AI 搜索现状，请稍候...");
  try {
    const res = await runAISearchAudit({ query: keyword, maxResults: 6, searchDepth: "advanced" });
    print("AI 搜索审计结果", res.content);
  } catch (e) {
    console.log("  审计失败：", (e as Error).message, "\n");
  }
}

async function stepReadPage(): Promise<{ title: string; markdown: string; content: string } | null> {
  const url = await ask("2️⃣  请输入要优化的页面 URL（直接回车跳过）：");
  if (!url) return null;
  if (!url.startsWith("http")) {
    console.log("  请输入完整 URL（以 http 开头）。\n");
    return null;
  }
  console.log("  正在抓取页面，请稍候...");
  try {
    const res = await runContentReader({ url });
    print("页面结构摘要", res.content.slice(0, 1500));
    return { title: res.title, markdown: res.markdown, content: res.content };
  } catch (e) {
    console.log("  抓取失败：", (e as Error).message, "\n");
    return null;
  }
}

async function stepSchema(pageInfo: { title: string } | null): Promise<string | null> {
  const doIt = await ask("3️⃣  是否为本页生成 JSON-LD Schema？(y/n，默认 n)：");
  if (doIt.toLowerCase() !== "y" && doIt !== "Y") return null;
  const type = await ask("     Schema 类型（Article / Product / FAQPage，默认 Article）：") || "Article";
  const name = await ask("     名称（默认用页面标题）：") || pageInfo?.title || "页面标题";
  const desc = await ask("     简短描述（可选）：");
  const entity: Record<string, unknown> = { name };
  if (desc) entity.description = desc;
  entity.datePublished = new Date().toISOString().slice(0, 10);
  try {
    const res = runSchemaGenerator({ type, entity });
    print("生成的 JSON-LD", res.content);
    return res.jsonLd;
  } catch (e) {
    console.log("  生成失败：", (e as Error).message, "\n");
    return null;
  }
}

async function stepPublish(pageInfo: { title: string; markdown: string } | null): Promise<void> {
  const hasWp =
    env.WORDPRESS_URL && env.WORDPRESS_USER && env.WORDPRESS_APP_PASSWORD;
  if (!hasWp) {
    console.log("4️⃣  未配置 WordPress（.env 中 WORDPRESS_*），跳过发布。\n");
    return;
  }
  const doIt = await ask("4️⃣  是否发布到 WordPress？(y/n，默认 n)：");
  if (doIt.toLowerCase() !== "y" && doIt !== "Y") return;
  const postId = await ask("     WordPress 文章/页面 ID：");
  if (!postId) {
    console.log("  未输入 ID，跳过发布。\n");
    return;
  }
  const title = await ask("     标题（直接回车保持原样不更新）：") || undefined;
  const content = await ask("     正文内容（直接回车保持原样；可粘贴 Markdown）：") || undefined;
  const excerpt = await ask("     摘要（可选，直接回车跳过）：") || undefined;
  if (!title && !content && !excerpt) {
    console.log("  未填写任何要更新的字段，跳过发布。\n");
    return;
  }
  console.log("  正在发布...");
  try {
    const res = await runCMSBridge({
      postId: /^\d+$/.test(postId) ? parseInt(postId, 10) : postId,
      postType: "post",
      title,
      content: content || undefined,
      excerpt: excerpt || undefined,
    });
    print("发布结果", res.content);
  } catch (e) {
    console.log("  发布失败：", (e as Error).message, "\n");
  }
}

async function main(): Promise<void> {
  console.log("\n  GEO 智能体 · 交互式优化\n  按提示输入，一步步完成审计 → 抓取 → Schema → 发布。直接回车可跳过当前步。\n");

  await stepAudit();
  const pageInfo = await stepReadPage();
  await stepSchema(pageInfo);
  await stepPublish(pageInfo);

  console.log("  全部完成。\n");
  rl.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
