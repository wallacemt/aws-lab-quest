"use client";

import { useState } from "react";
import { PixelButton } from "@/components/ui/pixel-button";
import { VisaoGeralTab } from "@/features/admin/components/dashboard/VisaoGeralTab";
import { QuestoesTab } from "@/features/admin/components/dashboard/QuestoesTab";
import { UsuariosTab } from "@/features/admin/components/dashboard/UsuariosTab";
import { EngajamentoTab } from "@/features/admin/components/dashboard/EngajamentoTab";
import { SistemaTab } from "@/features/admin/components/dashboard/SistemaTab";

type TabId = "visao-geral" | "questoes" | "usuarios" | "engajamento" | "sistema";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "visao-geral", label: "Visao Geral" },
  { id: "questoes", label: "Questoes" },
  { id: "usuarios", label: "Usuarios" },
  { id: "engajamento", label: "Engajamento" },
  { id: "sistema", label: "Sistema" },
];

const PERIOD_OPTIONS = [14, 30, 60, 90] as const;

export function AdminDashboardScreen() {
  const [activeTab, setActiveTab] = useState<TabId>("visao-geral");
  const [days, setDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);

  function renderTab() {
    switch (activeTab) {
      case "visao-geral":
        return <VisaoGeralTab days={days} refreshKey={refreshKey} />;
      case "questoes":
        return <QuestoesTab days={days} refreshKey={refreshKey} />;
      case "usuarios":
        return <UsuariosTab days={days} refreshKey={refreshKey} />;
      case "engajamento":
        return <EngajamentoTab days={days} refreshKey={refreshKey} />;
      case "sistema":
        return <SistemaTab days={days} refreshKey={refreshKey} />;
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4">
      {/* Period selector + refresh — above tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase text-[#94a3b8]">Periodo:</span>
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDays(option)}
            className={`border px-3 py-1 font-mono text-[10px] uppercase transition-colors ${
              days === option
                ? "border-[#f97316] text-[#f97316]"
                : "border-[#334155] text-[#94a3b8] hover:border-[#475569] hover:text-[#cbd5e1]"
            }`}
          >
            {option} dias
          </button>
        ))}
        <PixelButton variant="ghost" onClick={() => setRefreshKey((prev) => prev + 1)}>
          Atualizar
        </PixelButton>
      </div>

      {/* Tab bar — exact style from AdminEmailScreen */}
      <div className="flex gap-1 border-b border-[#1e293b]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-mono text-[10px] uppercase transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-[#f97316] text-[#f97316]"
                : "text-[#94a3b8] hover:text-[#cbd5e1]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <section>{renderTab()}</section>
    </main>
  );
}
