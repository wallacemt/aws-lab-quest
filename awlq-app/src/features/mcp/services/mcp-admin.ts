"use client";

import type { McpScope } from "@/features/mcp/scopes";

export type McpSettings = {
  enabled: boolean;
  endpointUrl: string;
  pdfUrlAllowlist: string[];
};

export type TokenInfo = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  ownerEmail: string;
  status: "active" | "expired" | "revoked";
};

export type CreateTokenPayload = {
  name: string;
  expiresInDays: 1 | 7 | 30 | 90;
  scopes: McpScope[];
};

export type CreateTokenResponse = {
  token: Omit<TokenInfo, "ownerEmail" | "status"> & { createdAt: string };
  secret: string;
};

export type CatalogScope = {
  id: string;
  domain: string | null;
  action: "read" | "write" | "danger";
  label: string;
};

export type CatalogTool = {
  name: string;
  title: string;
  domain: string;
  tier: "read" | "write" | "danger";
};

export type CatalogResponse = {
  scopes: CatalogScope[];
  tools: CatalogTool[];
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, credentials: "include" });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getMcpSettings(): Promise<McpSettings> {
  return fetchJson<McpSettings>("/api/admin/mcp/settings");
}

export async function updateMcpSettings(input: { enabled?: boolean; pdfUrlAllowlist?: string[] }): Promise<McpSettings> {
  return fetchJson<McpSettings>("/api/admin/mcp/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getMcpCatalog(): Promise<CatalogResponse> {
  return fetchJson<CatalogResponse>("/api/admin/mcp/catalog");
}

export async function listMcpTokens(): Promise<{ tokens: TokenInfo[] }> {
  return fetchJson<{ tokens: TokenInfo[] }>("/api/admin/mcp/tokens");
}

export async function createMcpToken(payload: CreateTokenPayload): Promise<CreateTokenResponse> {
  return fetchJson<CreateTokenResponse>("/api/admin/mcp/tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function revokeMcpToken(tokenId: string): Promise<{ ok: true; revokedAt: string }> {
  return fetchJson<{ ok: true; revokedAt: string }>(`/api/admin/mcp/tokens/${tokenId}`, {
    method: "DELETE",
  });
}