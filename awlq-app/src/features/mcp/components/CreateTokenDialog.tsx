"use client";

import { useState } from "react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelDialog } from "@/components/ui/pixel-dialog";
import { ScopePicker } from "@/features/mcp/components/ScopePicker";
import { createMcpToken, type CreateTokenPayload, type CreateTokenResponse } from "@/features/mcp/services/mcp-admin";
import { MCP_SCOPES, type McpScope } from "@/features/mcp/scopes";

interface CreateTokenDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (response: CreateTokenResponse) => void;
}

const EXPIRY_OPTIONS = [
  { value: 1, label: "1 dia" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias (máximo)" },
] as const;

export function CreateTokenDialog({ open, onClose, onCreated }: CreateTokenDialogProps) {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<1 | 7 | 30 | 90>(30);
  const [scopes, setScopes] = useState<McpScope[]>([]);
  const [danger, setDanger] = useState(false);
  const [dangerConfirmName, setDangerConfirmName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const readOnlyScopes = MCP_SCOPES.filter((s) => s.action === "read").map((s) => s.id);
  const initialScopes = readOnlyScopes;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    if (scopes.length === 0) {
      setError("Selecione ao menos um escopo");
      return;
    }
    if (danger && dangerConfirmName !== name) {
      setError("Digite exatamente o nome do token para confirmar ações perigosas");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateTokenPayload = {
        name: name.trim(),
        expiresInDays,
        scopes,
      };
      const response = await createMcpToken(payload);
      onCreated(response);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar token");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setName("");
    setExpiresInDays(30);
    setScopes(initialScopes);
    setDanger(false);
    setDangerConfirmName("");
    setError("");
  };

  return (
    <PixelDialog open={open} onOpenChange={onClose} title="Criar token MCP">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-[var(--admin-inset)] border border-[var(--pixel-danger)] text-[var(--pixel-danger)] font-reading text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Nome do token</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: claude-code-prod"
              maxLength={60}
              className="w-full h-11 border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] px-3 font-reading text-sm text-[var(--pixel-text)] outline-none focus:border-[var(--pixel-primary)]"
              disabled={submitting}
              autoFocus
            />
            <p className="font-reading text-xs text-[var(--pixel-subtext)]">Identificação interna (ex: &ldquo;claude-code-prod&rdquo;, &ldquo;ci-pipeline&rdquo;)</p>
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Validade</label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value) as 1 | 7 | 30 | 90)}
              className="w-full h-11 border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] px-3 font-reading text-sm text-[var(--pixel-text)] outline-none focus:border-[var(--pixel-primary)]"
              disabled={submitting}
            >
              {EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Escopos</label>
            <p className="font-reading text-xs text-[var(--pixel-subtext)]">
              Padrão: apenas leituras. Marque &ldquo;Ler+Escrever&rdquo; nos domínios necessários.
            </p>
            <ScopePicker
              value={scopes}
              onChange={setScopes}
              danger={danger}
              onDangerChange={setDanger}
              confirmDangerName={dangerConfirmName}
              tokenName={name}
            />
          </div>

          <div className="pt-4 border-t border-[var(--pixel-muted)] flex gap-2 justify-end">
            <PixelButton variant="ghost" type="button" onClick={handleReset} disabled={submitting}>
              LIMPAR
            </PixelButton>
            <PixelButton variant="ghost" type="button" onClick={onClose} disabled={submitting}>
              CANCELAR
            </PixelButton>
            <PixelButton type="submit" disabled={submitting}>
              {submitting ? "CRIANDO…" : "CRIAR TOKEN"}
            </PixelButton>
          </div>
        </form>
    </PixelDialog>
  );
}

