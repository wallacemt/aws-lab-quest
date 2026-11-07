"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelDialog } from "@/components/ui/pixel-dialog";

interface TokenRevealDialogProps {
  open: boolean;
  onClose: () => void;
  secret: string;
  tokenName: string;
  endpointUrl: string;
}

export function TokenRevealDialog({ open, onClose, secret, tokenName, endpointUrl }: TokenRevealDialogProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (prevOpenRef.current !== open) {
      setCopied(false);
      setConfirmed(false);
      prevOpenRef.current = open;
    }
  }, [open]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const snippet = `claude mcp add --transport http awlq-admin ${endpointUrl} --header "Authorization: Bearer ${secret}"`;

  const handleClose = () => {
    if (confirmed) onClose();
  };

  return (
    <PixelDialog open={open} onOpenChange={handleClose} title="Token criado com sucesso">
        <div className="space-y-6">
          <div className="space-y-2 border-2 border-[var(--pixel-danger)] bg-[var(--admin-inset)] p-4 pixel-hazard">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-danger)] flex items-center gap-1">
              <AlertTriangle size={12} /> Segredo exibido apenas uma vez
            </p>
            <p className="font-reading text-sm text-[var(--pixel-text)]">
              Copie e guarde este segredo agora. Ele <strong>não poderá ser recuperado</strong> após fechar este dialog.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Nome do token</label>
            <code className="block bg-[var(--admin-inset)] px-3 py-2 font-reading text-sm text-[var(--pixel-text)] border border-[var(--admin-control-border)]">{tokenName}</code>
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Segredo (copie agora)</label>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 bg-[var(--admin-inset)] px-3 py-2 font-code text-xs text-[var(--pixel-text)] border border-[var(--admin-control-border)] break-all">{secret}</code>
              <PixelButton
                variant="ghost"
                className="shrink-0 self-center"
                onClick={handleCopy}
                aria-label={copied ? "Copiado!" : "Copiar segredo"}
              >
                {copied ? <Check size={14} className="text-[var(--admin-status-ok)]" /> : <Copy size={14} />}
              </PixelButton>
            </div>
            <p className="font-reading text-xs text-[var(--pixel-subtext)]">
              Prefixo: <code className="font-code">{secret.slice(0, 16)}…</code> (o segredo completo tem {secret.length} caracteres)
            </p>
          </div>

          <div className="space-y-2 border-t border-[var(--pixel-muted)] pt-4">
            <label className="block font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Configuração no Claude Code</label>
            <p className="font-reading text-xs text-[var(--pixel-subtext)]">
              Execute no terminal onde roda o Claude Code:
            </p>
            <div className="flex items-start gap-2 bg-[var(--admin-inset)] border border-[var(--admin-control-border)] p-3">
              <code className="min-w-0 flex-1 font-code text-xs text-[var(--pixel-text)] break-all">{snippet}</code>
              <PixelButton
                variant="ghost"
                className="shrink-0"
                onClick={async () => { await navigator.clipboard.writeText(snippet); }}
                aria-label="Copiar comando"
              >
                <Copy size={14} />
              </PixelButton>
            </div>
            <p className="font-reading text-xs text-[var(--pixel-subtext)]">
              Ou configure manualmente no <code className="font-code">.claude.json</code> / <code className="font-code">.mcp.json</code> do projeto.
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--pixel-muted)]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4 accent-[var(--pixel-primary)]"
                required
              />
              <span className="font-reading text-sm text-[var(--pixel-text)]">
                <strong>Já copiei o token</strong> — entendo que não poderei vê-lo novamente.
              </span>
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <PixelButton variant="danger-solid" onClick={handleClose} disabled={!confirmed}>
              FECHAR (SEGREDO PERDIDO)
            </PixelButton>
          </div>
        </div>
    </PixelDialog>
  );
}
