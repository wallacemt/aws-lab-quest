import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";

const MCP_ENABLED_KEY = "mcp_enabled";
const PDF_URL_ALLOWLIST_KEY = "pdf_url_allowlist";
const MAX_PDF_URL_ALLOWLIST_HOSTS = 20;

const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export async function isMcpEnabled(): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: MCP_ENABLED_KEY },
    select: { value: true },
  });

  return config?.value === "true";
}

export async function setMcpEnabled(enabled: boolean): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: MCP_ENABLED_KEY },
    create: { key: MCP_ENABLED_KEY, value: String(enabled) },
    update: { value: String(enabled) },
  });
}

export async function getPdfUrlAllowlist(): Promise<string[]> {
  const config = await prisma.systemConfig.findUnique({
    where: { key: PDF_URL_ALLOWLIST_KEY },
    select: { value: true },
  });

  if (!config?.value) return [];

  try {
    const hosts: unknown = JSON.parse(config.value);
    return Array.isArray(hosts) && hosts.every((host) => typeof host === "string") ? hosts : [];
  } catch {
    return [];
  }
}

export async function setPdfUrlAllowlist(hosts: string[]): Promise<void> {
  if (!Array.isArray(hosts)) {
    throw new Error("A allowlist deve ser uma lista de hostnames.");
  }
  if (hosts.length > MAX_PDF_URL_ALLOWLIST_HOSTS) {
    throw new Error(`A allowlist aceita no máximo ${MAX_PDF_URL_ALLOWLIST_HOSTS} hostnames.`);
  }

  const normalizedHosts = hosts.map((host) => {
    if (typeof host !== "string") {
      throw new Error("Cada entrada da allowlist deve ser um hostname.");
    }

    const normalizedHost = host.toLowerCase();
    if (
      normalizedHost.length === 0 ||
      normalizedHost.includes(":") ||
      normalizedHost.includes("/") ||
      normalizedHost.includes("\\") ||
      normalizedHost.includes("@") ||
      normalizedHost.includes("?") ||
      normalizedHost.includes("#") ||
      isIP(normalizedHost) !== 0
    ) {
      throw new Error(`Hostname inválido na allowlist: ${host}`);
    }

    const labels = normalizedHost.split(".");
    if (labels.some((label) => !HOSTNAME_LABEL_PATTERN.test(label))) {
      throw new Error(`Hostname inválido na allowlist: ${host}`);
    }

    return normalizedHost;
  });

  const uniqueHosts = [...new Set(normalizedHosts)];
  await prisma.systemConfig.upsert({
    where: { key: PDF_URL_ALLOWLIST_KEY },
    create: { key: PDF_URL_ALLOWLIST_KEY, value: JSON.stringify(uniqueHosts) },
    update: { value: JSON.stringify(uniqueHosts) },
  });
}
