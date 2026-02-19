/**
 * Schema-Generator Tool
 * 根据 Agent 提供的核心实体（产品、价格、专家名、评测分数等），
 * 自动生成符合 Schema.org 标准的 JSON-LD 代码。
 */

import { z } from "zod";

const inputSchema = z.object({
  /** 页面/内容类型：Article | Product | FAQPage | HowTo | Organization 等 */
  type: z
    .string()
    .describe("Schema.org 类型，如 Article, Product, FAQPage, HowTo, Organization"),
  /** 实体数据，根据 type 不同传入不同字段；通用字段：name, description, url */
  entity: z
    .record(z.unknown())
    .describe("实体数据，如 name, description, price, author, datePublished 等"),
  /** 可选：额外 @context，默认 https://schema.org */
  context: z.string().url().optional(),
});

export type SchemaGeneratorInput = z.infer<typeof inputSchema>;

export const schemaGeneratorDef = {
  name: "schema-generator" as const,
  title: "Schema Generator",
  description:
    "根据提供的核心实体（产品、价格、专家名、评测分数等）生成符合 Schema.org 标准的 JSON-LD 结构化数据，便于 AI 搜索引擎理解与引用。",
  inputSchema,
};

const SCHEMA_ORG = "https://schema.org";

export function runSchemaGenerator(input: SchemaGeneratorInput): { content: string; jsonLd: string } {
  const context = input.context ?? SCHEMA_ORG;
  const type = input.type.trim();
  const entity = input.entity as Record<string, unknown>;

  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entity)) {
    if (v === undefined || v === null) continue;
    const key = k.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
    const schemaKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    normalized[schemaKey] = v;
  }

  const graph = {
    "@context": context,
    "@type": type,
    ...normalized,
  };

  const jsonLd = JSON.stringify(graph, null, 2);

  const content = [
    "生成的 JSON-LD（可放入页面 <script type=\"application/ld+json\">）：",
    "```json",
    jsonLd,
    "```",
  ].join("\n");

  return { content, jsonLd };
}
