#!/usr/bin/env node
import "dotenv/config";
import express from "express";
import cors from "cors";

import { runAISearchAudit } from "./tools/ai-search-audit.js";
import { runContentReader } from "./tools/content-reader.js";
import { runSchemaGenerator } from "./tools/schema-generator.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

app.post("/geo/analyze", async (req, res) => {
  const { keyword, url } = req.body as { keyword?: string; url?: string };

  try {
    const result: any = { keyword, url };

    if (keyword) {
      try {
        const audit = await runAISearchAudit({
          query: keyword,
          maxResults: 5,
          searchDepth: "advanced",
        });
        result.audit = {
          content: audit.content,
          results: audit.results,
        };
      } catch (e: any) {
        result.auditError = e?.message ?? String(e);
      }
    }

    if (url) {
      try {
        const page = await runContentReader({ url });
        result.page = {
          title: page.title,
          metaDescription: page.metaDescription,
          headings: page.headings,
          markdownPreview:
            page.markdown.length > 2000
              ? page.markdown.slice(0, 2000) + "\n...\n(已截断)"
              : page.markdown,
        };

        const schema = runSchemaGenerator({
          type: "Article",
          entity: {
            name: page.title || "页面标题",
            description: page.metaDescription || "网页内容摘要",
            url,
          },
        });

        result.schemaJson = schema.jsonLd;

        // 针对 Demo：如果是校长“优化前”站点，给出对应的“优化后”示例 URL
        if (url.includes("corgi-site-before")) {
          result.afterDemoUrl = url.replace("corgi-site-before", "corgi-site-geo");
        }
      } catch (e: any) {
        result.pageError = e?.message ?? String(e);
      }
    }

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

app.listen(port, () => {
  console.log(`GEO Web Demo running at http://localhost:${port}`);
});

