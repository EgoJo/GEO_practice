#!/usr/bin/env node
/**
 * GEO MCP Server 入口
 * 通过 stdio 与 Claude Desktop / Cursor 等 MCP 客户端通信，暴露四个 GEO 工具。
 */

import { runAISearchAudit, aiSearchAuditDef } from "./tools/ai-search-audit.js";
import { runContentReader, contentReaderDef } from "./tools/content-reader.js";
import { runSchemaGenerator, schemaGeneratorDef } from "./tools/schema-generator.js";
import { runCMSBridge, cmsBridgeDef } from "./tools/cms-bridge.js";

const TOOLS = [
  {
    name: aiSearchAuditDef.name,
    description: aiSearchAuditDef.description,
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "目标关键词或自然语言搜索查询" },
        maxResults: { type: "number", description: "最多返回结果数", default: 10 },
        searchDepth: { type: "string", enum: ["basic", "advanced"], default: "advanced" },
      },
      required: ["query"],
    },
  },
  {
    name: contentReaderDef.name,
    description: contentReaderDef.description,
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "目标网页 URL" },
        waitForSelector: { type: "string" },
        waitForTimeout: { type: "number" },
      },
      required: ["url"],
    },
  },
  {
    name: schemaGeneratorDef.name,
    description: schemaGeneratorDef.description,
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Schema.org 类型" },
        entity: { type: "object", description: "实体数据" },
        context: { type: "string" },
      },
      required: ["type", "entity"],
    },
  },
  {
    name: cmsBridgeDef.name,
    description: cmsBridgeDef.description,
    inputSchema: {
      type: "object" as const,
      properties: {
        postId: { type: ["number", "string"], description: "文章/页面 ID" },
        postType: { type: "string", enum: ["post", "page"], default: "post" },
        title: { type: "string" },
        content: { type: "string" },
        excerpt: { type: "string" },
        meta: { type: "object" },
      },
      required: ["postId"],
    },
  },
];

async function handleCallTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    if (name === "ai-search-audit") {
      const result = await runAISearchAudit({
        query: String(args.query ?? ""),
        maxResults: typeof args.maxResults === "number" ? args.maxResults : 10,
        searchDepth: args.searchDepth === "advanced" ? "advanced" : "basic",
      });
      return { content: [{ type: "text", text: result.content }] };
    }
    if (name === "content-reader") {
      const result = await runContentReader({
        url: String(args.url ?? ""),
        waitForSelector: typeof args.waitForSelector === "string" ? args.waitForSelector : undefined,
        waitForTimeout: typeof args.waitForTimeout === "number" ? args.waitForTimeout : undefined,
      });
      return { content: [{ type: "text", text: result.content }] };
    }
    if (name === "schema-generator") {
      const result = runSchemaGenerator({
        type: String(args.type ?? "Article"),
        entity: (args.entity as Record<string, unknown>) ?? {},
        context: typeof args.context === "string" ? args.context : undefined,
      });
      return { content: [{ type: "text", text: result.content }] };
    }
    if (name === "cms-bridge") {
      const result = await runCMSBridge({
        postId: args.postId as number | string,
        postType: args.postType === "page" ? "page" : "post",
        title: typeof args.title === "string" ? args.title : undefined,
        content: typeof args.content === "string" ? args.content : undefined,
        excerpt: typeof args.excerpt === "string" ? args.excerpt : undefined,
        meta: typeof args.meta === "object" && args.meta !== null ? (args.meta as Record<string, string>) : undefined,
      });
      return { content: [{ type: "text", text: result.content }] };
    }
    return { content: [{ type: "text", text: `未知工具: ${name}` }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `错误: ${message}` }] };
  }
}

function send(obj: unknown): void {
  const line = JSON.stringify(obj) + "\n";
  process.stdout.write(line);
}

async function processMessage(msg: Record<string, unknown>): Promise<void> {
  const id = msg.id;
  const method = msg.method as string | undefined;
  const params = (msg.params ?? {}) as Record<string, unknown>;
  const isNotification = id === undefined;

  if (method === "initialized" && isNotification) return;
  if (method === "notifications/initialized" && isNotification) return;

  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "geo-mcp-agent", version: "1.0.0" },
      },
    });
    return;
  }

  if (method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    });
    return;
  }

  if (method === "tools/call") {
    const name = (params.name as string) ?? "";
    const args = ((params.arguments as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    const result = await handleCallTool(name, args);
    send({
      jsonrpc: "2.0",
      id,
      result: {
        content: result.content,
        isError: false,
      },
    });
    return;
  }

  send({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

async function main(): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed) as Record<string, unknown>;
      await processMessage(msg);
    } catch {
      send({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
