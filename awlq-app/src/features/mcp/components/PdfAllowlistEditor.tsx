"use client";

import { useState, FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { updateMcpSettings } from "@/features/mcp/services/mcp-admin";
const MAX_HOSTS = 20;

interface PdfAllowlistEditorProps {
  initial: string[];
  onUpdate: (allowlist: string[]) => void;
}

export function PdfAllowlistEditor({ initial, onUpdate }: PdfAllowlistEditorProps) {
  const [hosts, setHosts] = useState<string[]>(initial);
  const [newHost, setNewHost] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validateHost = (host: string): string | null => {
    const normalized = host.toLowerCase().trim();
    if (!normalized) return "Hostname não pode ser vazio";
    if (normalized.includes(":") || normalized.includes("/") || normalized.includes("\\") || normalized.includes("@") || normalized.includes("?") || normalized.includes("#")) {
      return "Hostname inválido: não inclua esquema, porta, path ou credenciais";
    }
    if (/^\d+(\.\d+){3}$/.test(normalized) || /^\[?[0-9a-f:]+\]?$/i.test(normalized)) {
      return "Endereços IP literais não são permitidos";
    }
    const labels = normalized.split(".");
    if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
      return "Hostname inválido: labels devem seguir RFC 1123";
    }
    return null;
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const error = validateHost(newHost);
    if (error) {
      setErrors((prev) => ({ ...prev, [newHost]: error }));
      return;
    }
    if (hosts.length >= MAX_HOSTS) {
      setErrors((prev) => ({ ...prev, [newHost]: `Máximo de ${MAX_HOSTS} hosts permitidos` }));
      return;
    }
    const normalized = newHost.toLowerCase().trim();
    if (hosts.map((h) => h.toLowerCase()).includes(normalized)) {
      setErrors((prev) => ({ ...prev, [newHost]: "Host já existe na lista" }));
      return;
    }
    setHosts((prev) => [...prev, normalized]);
    setNewHost("");
    setErrors((prev) => { const next = { ...prev }; delete next[newHost]; return next; });
  };

  const handleRemove = (host: string) => {
    setHosts((prev) => prev.filter((h) => h !== host));
  };

  const handleSave = async () => {
    const hostErrors: Record<string, string> = {};
    for (const host of hosts) {
      const error = validateHost(host);
      if (error) hostErrors[host] = error;
    }
    if (Object.keys(hostErrors).length > 0) {
      setErrors(hostErrors);
      return;
    }
    if (hosts.length > MAX_HOSTS) {
      setErrors({ _form: `Máximo de ${MAX_HOSTS} hosts permitidos` });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMcpSettings({ pdfUrlAllowlist: hosts });
      setHosts(updated.pdfUrlAllowlist);
      onUpdate(updated.pdfUrlAllowlist);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Falha ao salvar allowlist");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PixelCard className="space-y-4 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-4 md:p-6">
      <header>
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Allowlist de PDF por URL</h2>
        <p className="mt-1 font-reading text-sm text-[var(--pixel-subtext)]">
          Domínios permitidos para ingestão de PDF via URL (tool <code className="font-code">pdf_ingest_url</code>).
          Vazio = ingestão por URL desligada. Máximo {MAX_HOSTS} hosts. Subdomínios são permitidos automaticamente.
        </p>
      </header>

      <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
        <label className="flex-1 min-w-[200px] relative">
          <input
            type="text"
            value={newHost}
            onChange={(e) => { setNewHost(e.target.value); setErrors((prev) => { const next = { ...prev }; delete next[e.target.value]; return next; }); }}
            placeholder="ex: d1.awsstatic.com"
            className={`w-full h-11 border-2 px-3 font-code text-sm text-[var(--pixel-text)] bg-[var(--admin-inset)] outline-none ${errors[newHost] ? "border-[var(--pixel-danger)]" : "border-[var(--admin-control-border)] focus:border-[var(--pixel-primary)]"} `}
            disabled={saving}
          />
          {errors[newHost] && <span className="absolute -bottom-5 left-0 font-reading text-xs text-[var(--pixel-danger)]">{errors[newHost]}</span>}
        </label>
        <PixelButton type="submit" disabled={saving || !newHost.trim()}>
          <Plus size={16} /> ADICIONAR
        </PixelButton>
      </form>

      {errors._form && <p className="font-reading text-sm text-[var(--pixel-danger)]">{errors._form}</p>}

      {hosts.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-[var(--admin-control-border)]">
          <p className="font-reading text-sm text-[var(--pixel-subtext)]">Nenhum domínio configurado — ingestão por URL desligada</p>
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {hosts.map((host) => (
            <li key={host} className="flex items-center gap-2 px-3 py-2 bg-[var(--admin-inset)] border border-[var(--admin-control-border)]">
              <code className="flex-1 font-code text-sm text-[var(--pixel-text)] break-all">{host}</code>
              {errors[host] && <span className="font-reading text-xs text-[var(--pixel-danger)]">{errors[host]}</span>}
              <PixelButton variant="ghost" onClick={() => handleRemove(host)} aria-label={`Remover ${host}`}>
                <Trash2 size={14} />
              </PixelButton>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-2">
        <PixelButton variant="danger" onClick={handleSave} disabled={saving}>
          {saving ? "SALVANDO…" : "SALVAR ALLOWLIST"}
        </PixelButton>
      </div>
    </PixelCard>
  );
}