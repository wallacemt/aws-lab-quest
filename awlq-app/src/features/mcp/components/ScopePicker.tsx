"use client";

import { useMemo, useEffect } from "react";
import { Skull, Shield } from "lucide-react";
import { PixelCard } from "@/components/ui/pixel-card";
import { MCP_SCOPES, type McpDomain, type McpScope } from "@/features/mcp/scopes";

type ScopeState = "none" | "read" | "write";

interface ScopePickerProps {
  value: McpScope[];
  onChange: (scopes: McpScope[]) => void;
  danger: boolean;
  onDangerChange: (checked: boolean) => void;
  confirmDangerName?: string;
  onConfirmDangerNameChange: (name: string) => void;
  tokenName?: string;
}

const DOMAIN_ORDER: McpDomain[] = ["users", "questions", "ingestion", "simulados", "gamification", "content", "email", "ops", "metrics"];

export function ScopePicker({ value, onChange, danger, onDangerChange, confirmDangerName, onConfirmDangerNameChange, tokenName }: ScopePickerProps) {
  const scopeSet = useMemo(() => new Set(value), [value]);

  const domainState = useMemo((): Record<string, ScopeState> => {
    const state: Record<string, ScopeState> = {};
    for (const domain of DOMAIN_ORDER) {
      const hasWrite = scopeSet.has(`${domain}:write` as McpScope);
      const hasRead = scopeSet.has(`${domain}:read` as McpScope);
      if (hasWrite) state[domain] = "write";
      else if (hasRead) state[domain] = "read";
      else state[domain] = "none";
    }
    return state;
  }, [value]);

  const handleDomainChange = (domain: string, newState: ScopeState) => {
    const next = new Set(scopeSet);
    const readScope = `${domain}:read` as McpScope;
    const writeScope = `${domain}:write` as McpScope;

    next.delete(readScope);
    next.delete(writeScope);

    if (newState === "read") next.add(readScope);
    else if (newState === "write") {
      next.add(readScope);
      next.add(writeScope);
    }

    onChange(Array.from(next));
  };

  const handleDangerChange = (checked: boolean) => {
    if (checked && confirmDangerName && tokenName && confirmDangerName !== tokenName) {
      alert("O nome digitado n&atilde;o confere. Digite exatamente o nome do token para confirmar.");
      return;
    }
    onDangerChange(checked);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DOMAIN_ORDER.map((domain) => {
          const scopeInfo = MCP_SCOPES.find((s) => s.domain === domain && s.action === "read");
          const label = scopeInfo?.label ?? domain;
          const current = domainState[domain] ?? "none";

          return (
            <PixelCard key={domain} className="p-3 space-y-2 border-[var(--pixel-border)] bg-[var(--pixel-card)]">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">{label}</p>
              <div className={`grid gap-1 ${domain === "metrics" ? "grid-cols-2" : "grid-cols-3"}`}>
                {(domain === "metrics" ? (["none", "read"] as ScopeState[]) : (["none", "read", "write"] as ScopeState[])).map((state) => (
                  <label
                    key={state}
                    className={`relative cursor-pointer px-1 py-1.5 text-center font-mono text-[9px] uppercase leading-tight break-words transition-colors border-2 ${
                      current === state
                        ? "bg-[var(--pixel-primary)] text-[var(--pixel-bg)] border-[var(--pixel-primary)]"
                        : "bg-[var(--pixel-muted)] text-[var(--pixel-subtext)] border-transparent hover:border-[var(--admin-control-border)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`scope-${domain}`}
                      value={state}
                      checked={current === state}
                      onChange={() => handleDomainChange(domain, state)}
                      className="sr-only"
                    />
                    {state === "none" && "—"}
                    {state === "read" && "LER"}
                    {state === "write" && "LER+ESC"}
                  </label>
                ))}
              </div>
            </PixelCard>
          );
        })}
      </div>

      <PixelCard className="p-3 border-[var(--pixel-border)] bg-[var(--pixel-card)]">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={danger}
            onChange={(e) => handleDangerChange(e.target.checked)}
            className="w-4 h-4 accent-[var(--pixel-danger)]"
          />
          <span className="font-mono text-xs uppercase text-[var(--pixel-text)]">Ações perigosas (danger)</span>
          {danger && <Shield size={14} className="text-[var(--pixel-danger)]" />}
        </label>
        {danger && (
          <div className="mt-3 space-y-2 border-l-2 border-[var(--pixel-danger)] pl-3 pixel-hazard">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-danger)] flex items-center gap-1">
              <Skull size={12} /> Requer confirmação
            </p>
            <label className="block space-y-1">
              <span className="font-reading text-sm text-[var(--pixel-subtext)]">
                Digite o nome do token para confirmar que entende o risco:
              </span>
              <input
                type="text"
                value={confirmDangerName ?? ""}
                onChange={(e) => onConfirmDangerNameChange(e.target.value)}
                placeholder={tokenName ?? "nome do token"}
                className="w-full mt-1 h-10 border-2 border-[var(--admin-control-border)] bg-[var(--admin-inset)] px-2 font-reading text-sm text-[var(--pixel-text)] outline-none focus:border-[var(--pixel-danger)]"
              />
            </label>
          </div>
        )}
      </PixelCard>
    </div>
  );
}