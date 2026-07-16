"use client";

import { Pencil, Swords, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import type { Boss } from "@/features/admin/components/BossFormModal";

type Props = {
  boss: Boss;
  onEdit: (boss: Boss) => void;
  onToggleActive: (boss: Boss) => void;
  onDelete: (bossId: string) => void;
};

export function BossCard({ boss, onEdit, onToggleActive, onDelete }: Props) {
  return (
    <div
      className={`flex flex-col border bg-[#0a1020] transition-colors hover:bg-[#0d1628] ${
        boss.active ? "border-[#1e293b]" : "border-[#1e293b] opacity-50"
      }`}
    >
      {/* Artwork */}
      <div className="relative h-60 w-full overflow-hidden bg-[#111827]">
        {boss.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={boss.artworkUrl} alt={boss.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Swords size={28} className="text-[#334155]" />
          </div>
        )}

        <div className="absolute right-2 top-2">
          <span
            className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${
              boss.active
                ? "border-green-700 bg-green-900/60 text-green-400"
                : "border-[#334155] bg-[#0f172a]/80 text-[#64748b]"
            }`}
          >
            {boss.active ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="font-mono text-xs font-bold leading-snug text-[#e2e8f0] line-clamp-2">{boss.name}</p>
        <p className="font-mono text-[10px] text-[#64748b]">{boss.code}</p>

        <div className="flex flex-wrap gap-1.5">
          <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#94a3b8]">
            {boss.themeService}
          </span>
          <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#f97316]">
            {boss.maxHp} HP
          </span>
          <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] text-[#64748b]">
            {boss.damagePerCorrect} dano/acerto
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-[#1e293b]">
        <button
          onClick={() => onEdit(boss)}
          className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30"
          title="Editar"
        >
          <Pencil size={12} />
          Editar
        </button>
        <button
          onClick={() => onToggleActive(boss)}
          className="flex flex-1 items-center justify-center gap-1.5 border-x border-[#1e293b] px-3 py-2 text-[10px] uppercase text-[#94a3b8] hover:bg-[#1e293b]/50"
          title={boss.active ? "Desativar" : "Ativar"}
        >
          {boss.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
          {boss.active ? "Desativar" : "Ativar"}
        </button>
        <button
          onClick={() => onDelete(boss.id)}
          className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[9px] uppercase text-red-400 hover:bg-red-900/20"
          title="Remover"
        >
          <Trash2 size={12} />
          Remover
        </button>
      </div>
    </div>
  );
}
