/**
 * Content-Reader Tool
 * 基于 Playwright 深度抓取网页 HTML，自动提取 Markdown 文本、现有标题层级及 Schema 标记。
 */

import { z } from "zod";
import { chromium } from "playwright";
import TurndownService from "turndown";

const inputSchema = z.object({
  /** 要抓取的目标页面 URL */
  url: z.string().url().describe("目标网页 URL"),
  /** 可选：等待选择器出现再抓取（用于 SPA） */
  waitForSelector: z.string().optional(),
  /** 可选：等待毫秒数 */
  waitForTimeout: z.number().min(0).optional(),
});

export type ContentReaderInput = z.infer<typeof inputSchema>;

export const contentReaderDef = {
  name: "content-reader" as const,
  title: "Content Reader",
  description:
    "深度抓取目标网页的 HTML，提取为 Markdown 文本、标题层级（H1/H2/H3）及页面中的 JSON-LD Schema 标记，供 GEO 诊断与对比使用。",
  inputSchema,
};

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export async function runContentReader(
  input: ContentReaderInput
): Promise<{
  content: string;
  markdown: string;
  headings: Array<{ level: number; text: string }>;
  schemas: string[];
  title: string;
  metaDescription: string;
}> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(input.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    if (input.waitForSelector) {
      await page.waitForSelector(input.waitForSelector, {
        timeout: input.waitForTimeout ?? 10000,
      });
    } else if (input.waitForTimeout) {
      await page.waitForTimeout(input.waitForTimeout);
    }

    const title = await page.title();
    const metaEl = await page.$('meta[name="description"]');
    const metaDesc = metaEl
      ? await metaEl.evaluate((el) => (el as HTMLMetaElement).content)
      : "";

    const headings = await page.$$eval("h1, h2, h3, h4, h5, h6", (nodes) =>
      nodes.map((el) => {
        const tag = el.tagName.toLowerCase();
        const level = parseInt(tag.replace("h", ""), 10);
        return { level, text: (el as HTMLElement).innerText.trim() };
      })
    );

    const schemas = await page.$$eval(
      'script[type="application/ld+json"]',
      (nodes) =>
        nodes
          .map((el) => (el as HTMLScriptElement).textContent?.trim() ?? "")
          .filter(Boolean) as string[]
    );

    const mainContent =
      (await page.$("main, article, [role='main'], #content, .content, .post-content, .entry-content").catch(() => null)) ??
      (await page.$("body"));
    if (!mainContent) throw new Error("无法获取页面主体内容");
    const innerHtml = await mainContent.evaluate((el) => el.innerHTML);
    const markdown = turndown.turndown(innerHtml);

    const contentParts: string[] = [];
    contentParts.push(`# ${title}\n`);
    if (metaDesc) contentParts.push(`Meta Description: ${metaDesc}\n`);
    contentParts.push("## 标题结构\n");
    headings.forEach((h) => contentParts.push(`${"#".repeat(h.level)} ${h.text}`));
    contentParts.push("\n## 正文 (Markdown)\n");
    contentParts.push(markdown);
    if (schemas.length > 0) {
      contentParts.push("\n## 现有 JSON-LD Schema\n");
      schemas.forEach((s, i) => contentParts.push(`\n### Schema ${i + 1}\n\`\`\`json\n${s}\n\`\`\``));
    }

    return {
      content: contentParts.join("\n"),
      markdown,
      headings,
      schemas,
      title,
      metaDescription: metaDesc,
    };
  } finally {
    await browser.close();
  }
}
