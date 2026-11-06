import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { systemConfig: { findUnique, upsert } },
}));

import {
  getPdfUrlAllowlist,
  isMcpEnabled,
  setMcpEnabled,
  setPdfUrlAllowlist,
} from "@/features/mcp/server/settings-service";

describe("MCP settings service", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
  });

  it("treats missing settings as disabled and an empty allowlist", async () => {
    findUnique.mockResolvedValue(null);

    await expect(isMcpEnabled()).resolves.toBe(false);
    await expect(getPdfUrlAllowlist()).resolves.toEqual([]);
  });

  it("treats empty and invalid allowlist JSON as empty", async () => {
    findUnique.mockResolvedValueOnce({ value: "" }).mockResolvedValueOnce({ value: "not-json" });

    await expect(getPdfUrlAllowlist()).resolves.toEqual([]);
    await expect(getPdfUrlAllowlist()).resolves.toEqual([]);
  });

  it("reads and writes the MCP enabled setting as a boolean string", async () => {
    findUnique.mockResolvedValue({ value: "true" });

    await expect(isMcpEnabled()).resolves.toBe(true);
    await setMcpEnabled(false);

    expect(upsert).toHaveBeenCalledWith({
      where: { key: "mcp_enabled" },
      create: { key: "mcp_enabled", value: "false" },
      update: { value: "false" },
    });
  });

  it("normalizes hostnames and removes duplicates before persisting", async () => {
    await setPdfUrlAllowlist(["Docs.AWS.Example", "docs.aws.example", "aws.example"]);

    expect(upsert).toHaveBeenCalledWith({
      where: { key: "pdf_url_allowlist" },
      create: { key: "pdf_url_allowlist", value: '["docs.aws.example","aws.example"]' },
      update: { value: '["docs.aws.example","aws.example"]' },
    });
  });

  it.each(["127.0.0.1", "2001:db8::1", "https://docs.aws.example", "docs.aws.example:443", "docs.aws.example/path"]) (
    "rejects invalid host %s without persisting",
    async (host) => {
      await expect(setPdfUrlAllowlist([host])).rejects.toThrow(/hostname/i);
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it("rejects lists with more than twenty entries without persisting", async () => {
    const hosts = Array.from({ length: 21 }, (_, index) => `host-${index}.example`);

    await expect(setPdfUrlAllowlist(hosts)).rejects.toThrow(/20/);
    expect(upsert).not.toHaveBeenCalled();
  });
});
