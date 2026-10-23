import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool } from "./toolResult.ts";

type ToolKind = "read" | "write" | "destructive";

interface ToolDefinition<Shape extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  kind: ToolKind;
  input: Shape;
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>;
}

export function defineTool<Shape extends z.ZodRawShape>(server: McpServer, definition: ToolDefinition<Shape>): void {
  const schema = z.object(definition.input);
  const callback = async (args: unknown) => runTool(definition.name, () => definition.handler(schema.parse(args)));

  server.registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.input,
      annotations: {
        title: definition.title,
        readOnlyHint: definition.kind === "read",
        destructiveHint: definition.kind === "destructive",
        openWorldHint: true,
      },
    },
    callback as unknown as ToolCallback<Shape>,
  );
}
