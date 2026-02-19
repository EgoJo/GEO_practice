/**
 * CMS-Bridge Tool
 * 封装 WordPress REST API，授权 Agent 自动更新指定页面的正文、标题、摘要及 Meta Data。
 */

import { z } from "zod";
import { env, requireWordPress } from "../lib/env.js";

const inputSchema = z.object({
  /** 要更新的文章/页面 ID */
  postId: z.union([z.number(), z.string()]).describe("WordPress 文章或页面 ID"),
  /** 更新类型：post | page */
  postType: z.enum(["post", "page"]).optional().default("post"),
  /** 新标题 */
  title: z.string().optional(),
  /** 新正文（HTML 或 Markdown；若为 Markdown 将按简单规则转 HTML） */
  content: z.string().optional(),
  /** 摘要/摘要 */
  excerpt: z.string().optional(),
  /** 元数据：如 meta_description、yoast 等（视主题/插件而定） */
  meta: z.record(z.string()).optional(),
});

export type CMSBridgeInput = z.infer<typeof inputSchema>;

export const cmsBridgeDef = {
  name: "cms-bridge" as const,
  title: "CMS Bridge",
  description:
    "通过 WordPress REST API 更新指定页面/文章的正文、标题、摘要及 Meta Data。需配置 WORDPRESS_URL、WORDPRESS_USER、WORDPRESS_APP_PASSWORD。",
  inputSchema,
};

function markdownToHtml(md: string): string {
  const s = md
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/^<p>|<\/p>$/g, "");
  return s ? `<p>${s}</p>` : md;
}

export async function runCMSBridge(input: CMSBridgeInput): Promise<{ content: string; updated: boolean }> {
  const { url, user, password } = env.WORDPRESS_URL && env.WORDPRESS_USER && env.WORDPRESS_APP_PASSWORD
    ? { url: env.WORDPRESS_URL.replace(/\/$/, ""), user: env.WORDPRESS_USER, password: env.WORDPRESS_APP_PASSWORD }
    : requireWordPress();

  const postId = typeof input.postId === "string" ? parseInt(input.postId, 10) : input.postId;
  const base = `${url}/wp-json/wp/v2`;
  const endpoint = input.postType === "page" ? "pages" : "posts";
  const auth = Buffer.from(`${user}:${password}`).toString("base64");

  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.content !== undefined) {
    body.content = input.content.startsWith("<") ? input.content : markdownToHtml(input.content);
  }
  if (input.excerpt !== undefined) body.excerpt = input.excerpt;
  if (input.meta && Object.keys(input.meta).length > 0) body.meta = input.meta;

  if (Object.keys(body).length === 0) {
    return {
      content: "未提供要更新的字段（title/content/excerpt/meta），未执行更新。",
      updated: false,
    };
  }

  const res = await fetch(`${base}/${endpoint}/${postId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WordPress API 错误 (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id: number; title?: { rendered?: string }; link?: string };
  const content = [
    "更新成功。",
    `- ID: ${data.id}`,
    data.title?.rendered != null ? `- 标题: ${data.title.rendered}` : "",
    data.link != null ? `- 链接: ${data.link}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { content, updated: true };
}
