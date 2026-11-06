export type AuditStatus = "pending" | "ok" | "error" | "denied" | "rate_limited";
export type AuditActorType = "human" | "agent";

export type AuditEventDTO = {
  id: string;
  requestId: string;
  createdAt: string;
  actorType: AuditActorType;
  source: "admin_ui" | "mcp";
  actorUserId: string;
  actorEmail: string;
  tokenId: string | null;
  tokenName: string | null;
  tool: string | null;
  domain: string;
  action: string;
  path: string;
  resourceId: string | null;
  status: AuditStatus;
  httpStatus: number | null;
  durationMs: number | null;
  argsRedacted: unknown;
  errorMessage: string | null;
  ip: string | null;
  userAgent: string | null;
};

export type AuditPage = { items: AuditEventDTO[]; nextCursor: string | null };
export type AuditFilters = Partial<Record<"actorType" | "domain" | "action" | "tool" | "status" | "from" | "to" | "q" | "tokenId" | "actorUserId" | "period" | "tokenName", string>>;
export type AuditCatalogTool = { name: string; title: string; tier: "read" | "write" | "danger" };
