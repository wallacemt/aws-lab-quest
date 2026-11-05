"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { Skeleton } from "@/components/ui/skeleton";
import { McpSettingsCard } from "@/features/mcp/components/McpSettingsCard";
import { PdfAllowlistEditor } from "@/features/mcp/components/PdfAllowlistEditor";
import { TokenTable } from "@/features/mcp/components/TokenTable";
import { CreateTokenDialog } from "@/features/mcp/components/CreateTokenDialog";
import { TokenRevealDialog } from "@/features/mcp/components/TokenRevealDialog";
import { getMcpSettings, updateMcpSettings, listMcpTokens, revokeMcpToken, type McpSettings, type TokenInfo } from "@/features/mcp/services/mcp-admin";

export function AdminMcpScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<McpSettings | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [revealData, setRevealData] = useState<{ secret: string; tokenName: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [settingsData, tokensData] = await Promise.all([
        getMcpSettings(),
        listMcpTokens(),
      ]);
      setSettings(settingsData);
      setTokens(tokensData.tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSettingsUpdate = async (updated: Partial<McpSettings>) => {
    try {
      setError("");
      const result = await updateMcpSettings(updated);
      setSettings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar");
    }
  };

  const handleTokenRevoke = async (tokenId: string) => {
    try {
      setError("");
      await revokeMcpToken(tokenId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao revogar token");
    }
  };

  const handleTokenViewActions = (tokenId: string) => {
    router.push(`/admin/logs?actorType=agent&tokenId=${tokenId}`);
  };

  const handleCreateToken = async (response: { token: TokenInfo; secret: string }) => {
    await loadData();
    setRevealData({ secret: response.secret, tokenName: response.token.name });
    setRevealDialogOpen(true);
  };

  const handleRevealClose = () => {
    setRevealDialogOpen(false);
    setRevealData(null);
  };

  if (loading) {
    return (
      <main className="admin-console min-h-full space-y-6 bg-[var(--pixel-bg)] p-4 text-[var(--pixel-text)] md:p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-primary)]">INTEGRAÇÕES</p>
          <h1 className="mt-2 font-reading text-xl font-semibold">MCP (Model Context Protocol)</h1>
        </header>
        <div className="space-y-4">
          <PixelCard className="p-6"><div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div></PixelCard>
        </div>
      </main>
    );
  }

  if (error && !settings) {
    return (
      <main className="admin-console min-h-full space-y-6 bg-[var(--pixel-bg)] p-4 text-[var(--pixel-text)] md:p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-primary)]">INTEGRAÇÕES</p>
          <h1 className="mt-2 font-reading text-xl font-semibold">MCP (Model Context Protocol)</h1>
        </header>
        <div role="alert" className="border-2 border-[var(--pixel-danger)] p-4 font-reading text-sm">
          Não foi possível carregar a configuração MCP. <span>{error}</span>
          <PixelButton variant="danger" className="ml-4" onClick={loadData}>TENTAR DE NOVO</PixelButton>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-console min-h-full space-y-6 bg-[var(--pixel-bg)] p-4 text-[var(--pixel-text)] md:p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-wide text-[var(--pixel-primary)]">INTEGRAÇÕES</p>
        <h1 className="mt-2 font-reading text-xl font-semibold">MCP (Model Context Protocol)</h1>
      </header>

      <div className="space-y-6">
        <McpSettingsCard initial={settings!} onUpdate={handleSettingsUpdate} />
        <PdfAllowlistEditor initial={settings!.pdfUrlAllowlist} onUpdate={handleSettingsUpdate} />
        <TokenTable
          tokens={tokens}
          onRevoke={handleTokenRevoke}
          onViewActions={handleTokenViewActions}
          onCreate={() => setCreateDialogOpen(true)}
        />
      </div>

      <CreateTokenDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={handleCreateToken}
      />

      <TokenRevealDialog
        open={revealDialogOpen}
        onClose={handleRevealClose}
        secret={revealData?.secret ?? ""}
        tokenName={revealData?.tokenName ?? ""}
        endpointUrl={settings!.endpointUrl}
      />
    </main>
  );
}