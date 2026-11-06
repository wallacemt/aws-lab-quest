"use client";

import { useState } from "react";
import { Copy, AlertTriangle } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelSegmented } from "@/components/ui/pixel-segmented";
import { updateMcpSettings, type McpSettings } from "@/features/mcp/services/mcp-admin";

interface McpSettingsCardProps {
  initial: McpSettings;
  onUpdate: (settings: McpSettings) => void;
}

export function McpSettingsCard({ initial, onUpdate }: McpSettingsCardProps) {
  const [settings, setSettings] = useState<McpSettings>(initial);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingEnabled, setPendingEnabled] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    if (enabled && !showConfirm) {
      setPendingEnabled(true);
      setShowConfirm(true);
      return;
    }
    try {
      const updated = await updateMcpSettings({ enabled });
      setSettings(updated);
      onUpdate(updated);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Falha ao atualizar");
    } finally {
      setShowConfirm(false);
      setPendingEnabled(false);
    }
  };

  const copyEndpoint = async () => {
    await navigator.clipboard.writeText(settings.endpointUrl);
  };

  return (
    <PixelCard className="space-y-4 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-4 md:p-6">
      <header className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Status MCP</h2>
        <PixelSegmented
          legend="MCP"
          value={settings.enabled ? "on" : "off"}
          onChange={(v) => handleToggle(v === "on")}
          options={[
            { value: "off", label: "DESLIGADO" },
            { value: "on", label: "LIGADO" },
          ]}
        />
      </header>

      {settings.enabled && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Endpoint</label>
            <code className="flex-1 break-all bg-[var(--admin-inset)] px-2 py-1 font-code text-xs text-[var(--pixel-text)] border border-[var(--admin-control-border)]">{settings.endpointUrl}</code>
            <PixelButton variant="ghost" onClick={copyEndpoint} aria-label="Copiar endpoint">
              <Copy size={14} />
            </PixelButton>
          </div>
          <p className="font-reading text-sm text-[var(--pixel-subtext)] flex items-center gap-1">
            <AlertTriangle size={14} className="text-[var(--pixel-danger)]" />
            Um token MCP dá a um agente de IA os poderes de admin dos escopos escolhidos. Dados pessoais são mascarados nas respostas.
          </p>
        </div>
      )}

      {showConfirm && (
        <div className="border-2 border-[var(--pixel-danger)] bg-[var(--admin-inset)] p-3 space-y-2 pixel-hazard">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-danger)] flex items-center gap-1">
            <AlertTriangle size={12} /> Confirmação para ativar
          </p>
          <p className="font-reading text-sm text-[var(--pixel-text)]">
            Tem certeza que deseja ativar o MCP? Um token ativo permite que um agente de IA execute ações administrativas conforme os escopos concedidos.
          </p>
          <div className="flex gap-2">
            <PixelButton variant="danger-solid" onClick={() => handleToggle(true)}>CONFIRMAR ATIVAÇÃO</PixelButton>
            <PixelButton variant="ghost" onClick={() => setShowConfirm(false)}>CANCELAR</PixelButton>
          </div>
        </div>
      )}
    </PixelCard>
  );
}