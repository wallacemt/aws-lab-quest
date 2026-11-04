import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAdminRequestContext, runInAdminContext } from "@/lib/admin-request-context";
import { routeDomain } from "@/features/audit/server/route-domain";

export const ADMIN_AUDIT_WRAPPED = Symbol("adminAuditWrapped");

type RouteContext = { params?: unknown };

export function withAdminAudit<C>(
  routeKey: string,
  handler: (req: NextRequest, ctx: C) => Promise<Response>,
): ((req: NextRequest, ctx?: C) => Promise<Response>) & { [ADMIN_AUDIT_WRAPPED]?: true } {
  const wrapped = async (req: NextRequest, ctx?: C): Promise<Response> => {
    const executeAndAudit = async (): Promise<Response> => {
      let argsRedacted: unknown;
      try {
        argsRedacted = await req.clone().json();
      } catch {
        argsRedacted = undefined;
      }

      const startedAt = Date.now();
      let response: Response;
      let thrown: unknown;
      let didThrow = false;
      try {
        response = await handler(req, ctx as C);
      } catch (error) {
        didThrow = true;
        thrown = error;
        response = new Response(null, { status: 500 });
      }

      const context = getAdminRequestContext();
      if (context?.principal) {
        if (didThrow) throw thrown;
        return response;
      }

      if (!context?.actor) {
        console.warn(`[admin-audit] skipped unauthenticated route ${routeKey} status=${response.status}`);
        if (didThrow) throw thrown;
        return response;
      }

      let params: Record<string, unknown> = {};
      try {
        const candidate = (ctx as RouteContext | undefined)?.params;
        const resolved = await candidate;
        if (resolved && typeof resolved === "object") params = resolved as Record<string, unknown>;
      } catch {
        // Route params are best-effort metadata.
      }
      const paramEntries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
      const path = routeKey.replace(/\[([^\]]+)\]/g, (placeholder, name: string) => {
        const value = params[name];
        return value === undefined || value === null ? placeholder : String(value);
      });
      const forwardedFor = req.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
      try {
        const { recordEvent } = await import("@/features/audit/server/audit-service");
        await recordEvent({
          requestId: context.requestId,
          actorType: "human",
          source: "admin_ui",
          actorUserId: context.actor.userId,
          actorEmail: context.actor.email,
          domain: routeDomain(routeKey),
          action: `${req.method} ${routeKey}`,
          path,
          resourceId: paramEntries.length ? paramEntries.map(([, value]) => String(value)).join("-") : undefined,
          status: response.status < 400 && !didThrow ? "ok" : "error",
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          argsRedacted,
          ip: req.headers.get("x-real-ip") || forwardedFor,
          userAgent: req.headers.get("user-agent") ?? undefined,
        });
      } catch (error) {
        console.error(`[admin-audit] failed to record ${routeKey}`, error);
      }

      if (didThrow) throw thrown;
      return response;
    };

    if (getAdminRequestContext()) return executeAndAudit();
    return runInAdminContext({ requestId: randomUUID() }, executeAndAudit);
  };
  wrapped[ADMIN_AUDIT_WRAPPED] = true as const;
  return wrapped;
}
