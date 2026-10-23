import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../lib/logger.ts";
import { ToolError } from "./errors.ts";

export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

export function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export async function runTool(name: string, task: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await task());
  } catch (error) {
    if (error instanceof ToolError) {
      return fail(error.message);
    }
    logger.error("Tool failed", { tool: name, error });
    const message = error instanceof Error ? error.message : String(error);
    return fail(`${name} failed unexpectedly: ${message}`);
  }
}
