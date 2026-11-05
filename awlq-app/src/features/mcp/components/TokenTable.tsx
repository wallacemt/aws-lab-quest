"use client";

import { useState } from "react";
import { ExternalLink, Trash2, Shield } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ActorBadge } from "@/features/audit/components/ActorBadge";
import { type TokenInfo } from "@/features/mcp/services/mcp-admin";

interface TokenTableProps {
  tokens: TokenInfo[];
  onRevoke: (tokenId: string) => Promise<void>;
  onViewActions: (tokenId: string) => void;
  onCreate: () => void;
}

const STATUS_CONFIG = {
  active: { label: "ATIVO", color: "var(--admin-status-ok)", Icon: Shield },
  expired: { label: "EXPIRADO", color: "var(--admin-status-neutral)", Icon: Shield },
  revoked: { label: "REVOGADO", color: "var(--admin-status-error)", Icon: Shield },
} as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatScopes(scopes: string[]): React.ReactNode {
  if (scopes.length === 0) return <span className="text-[var(--pixel-subtext)]">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {scopes.map((scope) => (
        <span key={scope} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] uppercase font-mono bg-[var(--admin-inset)] border border-[var(--admin-control-border)]">
          {scope.includes(":write") && <Shield size={8} className="text-[var(--pixel-danger)]" />}
          {scope.replace(":", "·")}
        </span>
      ))}
    </span>
  );
}

export function TokenTable({ tokens, onRevoke, onViewActions, onCreate }: TokenTableProps) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ tokenId: string; name: string } | null>(null);

  const activeCount = tokens.filter((t) => t.status === "active").length;

  const handleRevoke = async (tokenId: string, name: string) => {
    setShowConfirm({ tokenId, name });
  };

  const confirmRevoke = async () => {
    if (!showConfirm) return;
    setRevoking(showConfirm.tokenId);
    try {
      await onRevoke(showConfirm.tokenId);
    } finally {
      setRevoking(null);
      setShowConfirm(null);
    }
  };

  return (
    <PixelCard className="border-[var(--pixel-border)] bg-[var(--pixel-card)]">
      <header className="border-b border-[var(--pixel-muted)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Tokens MCP</h2>
          <span className="px-2 py-0.5 font-mono text-[10px] text-[var(--pixel-text)] bg-[var(--admin-inset)] border border-[var(--admin-control-border)]">
            {activeCount}/5 ativos
          </span>
        </div>
        <PixelButton onClick={onCreate} disabled={activeCount >= 5}>
          NOVO TOKEN
        </PixelButton>
      </header>

      {tokens.length === 0 ? (
        <div className="p-8 text-center">
          <p className="font-reading text-sm text-[var(--pixel-subtext)]">Nenhum token criado ainda</p>
          <PixelButton variant="ghost" className="mt-3" onClick={onCreate}>
            CRIAR PRIMEIRO TOKEN
          </PixelButton>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" role="grid">
            <thead>
              <tr className="bg-[var(--pixel-muted)] font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Prefixo</th>
                <th className="px-3 py-2 text-left">Escopos</th>
                <th className="px-3 py-2 text-left">Expira em</th>
                <th className="px-3 py-2 text-left">Último uso</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-t border-[var(--pixel-muted)] hover:bg-[var(--admin-inset)]">
                  <td className="px-3 py-2 font-reading text-sm">{token.name}</td>
                  <td className="px-3 py-2 font-code text-xs text-[var(--pixel-subtext)]">{token.tokenPrefix}</td>
                  <td className="px-3 py-2">{formatScopes(token.scopes)}</td>
                  <td className="px-3 py-2 font-code text-xs text-[var(--pixel-subtext)]">{formatDate(token.expiresAt)}</td>
                  <td className="px-3 py-2 font-code text-xs text-[var(--pixel-subtext)]">{formatDate(token.lastUsedAt)}</td>
                  <td className="px-3 py-2">
                    <ActorBadge
                      actorType={token.status === "active" ? "agent" : "human"}
                      compact
                    />
                    <span className="ml-2 font-mono text-[10px] uppercase">
                      {STATUS_CONFIG[token.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {token.status === "active" && (
                        <>
                          <PixelButton
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewActions(token.id)}
                            aria-label={`Ver ações do token ${token.name}`}
                          >
                            <ExternalLink size={12} />
                          </PixelButton>
                          <PixelButton
                            variant="danger"
                            size="sm"
                            onClick={() => handleRevoke(token.id, token.name)}
                            disabled={revoking === token.id}
                            aria-label={`Revogar token ${token.name}`}
                          >
                            <Trash2 size={12} />
                          </PixelButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[var(--pixel-card)] border-2 border-[var(--pixel-danger)] p-6 pixel-hazard">
            <h3 className="font-mono text-xs uppercase text-[var(--pixel-danger)] flex items-center gap-1 mb-3">
              <Shield size={14} /> Confirmar revogação
            </h3>
            <p className="font-reading text-sm text-[var(--pixel-text)] mb-4">
              Revogar o token <strong>&ldquo;{showConfirm.name}&rdquo;</strong>? Esta ação é irreversível e o agente perderá acesso imediatamente.
            </p>
            <div className="flex gap-2 justify-end">
              <PixelButton variant="ghost" onClick={() => setShowConfirm(null)}>CANCELAR</PixelButton>
              <PixelButton variant="danger-solid" onClick={confirmRevoke} disabled={revoking === showConfirm.tokenId}>
                {revoking === showConfirm.tokenId ? "REVOGANDO…" : "REVOGAR"}
              </PixelButton>
            </div>
          </div>
        </div>
      )}
    </PixelCard>
  );
}