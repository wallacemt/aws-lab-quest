import { randomUUID } from "node:crypto";
import { runInAdminContext, type McpPrincipal } from "@/lib/admin-request-context";
import { redis } from "@/lib/redis";
import { finalizeEvent, recordEvent, startPendingEvent } from "@/features/audit/server/audit-service";
import { getToolsForScopes } from "@/features/mcp/server/catalog";
import type { AdminToolDef } from "@/features/mcp/server/catalog/types";
import { maskPersonalData } from "./pii-mask";

type RequestMetadata = { request: Request; ip: string; userAgent: string; requestId?: string };
type AuditBase = { requestId: string; actorType: "agent"; source: "mcp"; actorUserId: string; actorEmail: string; tokenId: string; tool: string; domain: string; action: string; path: string; argsRedacted: unknown; ip: string; userAgent: string };

async function incrementWindow(key: string, limit: number): Promise<boolean> {
  if (!redis) throw new Error("Redis indisponível");
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count > limit;
}

function mcpError(message: string) { return { content: [{ type: "text" as const, text: message }], isError: true }; }

export async function executeTool(tool: AdminToolDef, input: unknown, principal: McpPrincipal, metadata: RequestMetadata) {
  const requestId = metadata.requestId ?? randomUUID();
  const start = Date.now();
  let pendingId: string | undefined;
  let responseStatus = 500;
  let failureMessage: string | undefined;
  let recordedEarly = false;
  const allowed = getToolsForScopes(principal.scopes).some((candidate) => candidate.name === tool.name);
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const base: AuditBase = {
    requestId, actorType: "agent", source: "mcp", actorUserId: principal.userId, actorEmail: principal.email,
    tokenId: principal.tokenId, tool: tool.name, domain: tool.domain, action: tool.name,
    path: `/api/admin/${tool.path}`, argsRedacted: args, ip: metadata.ip, userAgent: metadata.userAgent,
  };
  const auditingRequired = tool.tier !== "read";
  try {
    if (!allowed) {
      recordedEarly = true;
      await recordEvent({ ...base, status: "denied", httpStatus: 403, durationMs: Date.now() - start });
      return mcpError("Ação não autorizada para este token.");
    }
    if (tool.tier !== "read" && await incrementWindow(`mcp:write:${principal.tokenId}`, 30)) {
      recordedEarly = true;
      await recordEvent({ ...base, status: "rate_limited", httpStatus: 429, durationMs: Date.now() - start });
      return mcpError("Limite de ações de escrita excedido.");
    }
    const denial = await tool.preflight?.(args as never);
    if (denial) {
      recordedEarly = true;
      await recordEvent({ ...base, status: "denied", httpStatus: 403, durationMs: Date.now() - start, errorMessage: denial });
      return mcpError(denial);
    }
    if (auditingRequired) {
      try { pendingId = await startPendingEvent(base); }
      catch (error) { console.error(error instanceof Error ? error.stack : error); return mcpError("Auditoria indisponivel; acao bloqueada"); }
    }

    const pathParams: Record<string, string> = {};
    for (const key of tool.pathParams ?? []) {
      const value = args[String(key)];
      if (value !== undefined) pathParams[String(key)] = String(value);
    }
    const path = tool.path.replace(/\[([^\]]+)\]/g, (_match, key: string) => encodeURIComponent(pathParams[key] ?? ""));
    const query = new URLSearchParams();
    for (const key of tool.queryParams ?? []) {
      const value = args[String(key)];
      if (value !== undefined) query.set(String(key), String(value));
    }
    const queryString = query.size ? `?${query}` : "";
    const bodyInput = Object.fromEntries(Object.entries(args).filter(([key]) => !tool.pathParams?.some((p) => String(p) === key) && !tool.queryParams?.some((p) => String(p) === key)));
    const body = tool.buildBody ? tool.buildBody(args as never) : bodyInput;
    const hasBody = tool.method !== "GET" && tool.method !== "DELETE" && (tool.buildBody !== undefined || Object.keys(bodyInput).length > 0);
    const headers = new Headers();
    if (hasBody) headers.set("content-type", "application/json");
    for (const name of ["x-real-ip", "x-forwarded-for", "user-agent"]) {
      const value = metadata.request.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("X-AWLQ-Actor", "mcp-agent");
    headers.set("X-AWLQ-Mcp-Token-Id", principal.tokenId);
    headers.set("X-AWLQ-Request-Id", requestId);
    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL não configurada");
    const synthetic = new Request(`${appUrl.replace(/\/$/, "")}/api/admin/${path}${queryString}`, {
      method: tool.method, headers, ...(hasBody ? { body: JSON.stringify(body) } : {}),
    });
    const handler = await tool.handler();
    const response = await runInAdminContext({ requestId, principal }, () => handler(synthetic, { params: Promise.resolve(pathParams) }));
    responseStatus = response.status;
    const raw = await response.text();
    let result: unknown;
    try { result = JSON.parse(raw); } catch { result = raw; }
    const safe = maskPersonalData(result);
    let text = typeof safe === "string" ? safe : JSON.stringify(safe, null, 2);
    if (text.length > 32000) text = `${text.slice(0, 32000)}\n\n[Resposta truncada em 32000 caracteres. Refine os filtros ou consulte páginas menores.]`;
    return { content: [{ type: "text" as const, text }], isError: !response.ok };
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    failureMessage = "Falha ao executar a ferramenta administrativa.";
    return mcpError(failureMessage);
  } finally {
    const durationMs = Date.now() - start;
    try {
      if (pendingId) await finalizeEvent(pendingId, { status: responseStatus >= 400 ? "error" : "ok", httpStatus: responseStatus, durationMs, ...(failureMessage ? { errorMessage: failureMessage } : {}) });
      else if (!auditingRequired && !recordedEarly) await recordEvent({ ...base, status: responseStatus >= 400 ? "error" : "ok", httpStatus: responseStatus, durationMs, ...(failureMessage ? { errorMessage: failureMessage } : {}) });
    } catch (error) { console.error("Falha ao concluir auditoria MCP", error); }
  }
}

export const executor = { execute: executeTool };
