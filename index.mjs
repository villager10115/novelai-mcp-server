import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { NAI_BASE_URL, getToken } from "./src/config.mjs";
import { logError, okText, jsonText } from "./src/utils.mjs";
import { novelAiRequest } from "./src/novelai-client.mjs";
import { registerImageTools } from "./src/tools-image.mjs";

const server = new McpServer({
  name: "novelai-mcp-server",
  version: "0.1.2"
});

server.onerror = (error) => {
  logError("server.onerror", error);
};

process.on("uncaughtException", (error) => {
  logError("uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  logError("unhandledRejection", reason);
});

process.stdin.on("close", () => {
  console.error("[MCP] stdin closed");
  process.exit(0);
});

server.tool(
  "novelai_validate_token",
  {},
  async () => {
    try {
      const token = getToken();
      return jsonText({
        ok: true,
        tokenPrefix: token.slice(0, 8),
        note: "Token exists and matches pst- prefix."
      });
    } catch (error) {
      logError("novelai_validate_token", error);
      return jsonText({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

server.tool(
  "novelai_chat",
  {
    prompt: z.string().min(1),
    system: z.string().optional(),
    model: z.string().default("glm-4-6"),
    max_tokens: z.number().int().positive().max(8192).default(300),
    temperature: z.number().min(0).max(2).default(0.7),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().int().positive().optional(),
    min_p: z.number().min(0).max(1).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    stop: z.array(z.string()).optional()
  },
  async ({ prompt, system, ...params }) => {
    try {
      const messages = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });

      const result = await novelAiRequest("/ai/generate-stream", {
        messages,
        ...params
      });

      const output =
        result?.text ||
        result?.choices?.[0]?.text ||
        result?.choices?.[0]?.message?.content ||
        result?.raw ||
        "";

      return okText(output.trim() || JSON.stringify(result, null, 2));
    } catch (error) {
      logError("novelai_chat", error);
      return jsonText({
        ok: false,
        tool: "novelai_chat",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

server.tool(
  "novelai_generate",
  {
    messages: z.array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string()
      })
    ).min(1),
    model: z.string().default("glm-4-6"),
    max_tokens: z.number().int().positive().max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().int().positive().optional(),
    min_p: z.number().min(0).max(1).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    stop: z.array(z.string()).optional(),
    enable_thinking: z.boolean().optional(),
    endpoint: z.enum(["/ai/generate-stream", "/ai/generate"]).default("/ai/generate-stream")
  },
  async ({ endpoint, ...input }) => {
    try {
      const result = await novelAiRequest(endpoint, input);
      return jsonText({
        ok: true,
        endpoint,
        result
      });
    } catch (error) {
      logError("novelai_generate", error);
      return jsonText({
        ok: false,
        tool: "novelai_generate",
        endpoint,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

registerImageTools(server);

async function main() {
  console.error("[MCP] NovelAI MCP server starting...");
  console.error(`[MCP] Base URL: ${NAI_BASE_URL}`);
  console.error(
    `[MCP] Token present: ${Boolean(process.env.NOVELAI_TOKEN || process.env.NAI_PERSISTENT_TOKEN)}`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP] NovelAI MCP server connected over stdio");
}

main().catch((error) => {
  logError("Fatal startup error", error);
  process.exit(1);
});