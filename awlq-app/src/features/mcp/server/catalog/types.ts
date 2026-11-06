import type { z } from "zod";
import type { McpDomain } from "@/features/mcp/scopes";

export type { McpDomain };
export type ToolTier = "read" | "write" | "danger";
export type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface AdminToolDef<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  domain: McpDomain;
  tier: ToolTier;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  inputSchema: S;
  pathParams?: (keyof z.infer<S>)[];
  queryParams?: (keyof z.infer<S>)[];
  buildBody?: (input: z.infer<S>) => unknown;
  preflight?: (input: z.infer<S>) => Promise<string | null>;
  handler: () => Promise<RouteHandler>;
}
