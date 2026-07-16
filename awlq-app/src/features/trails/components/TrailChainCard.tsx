"use client";

import { ListTree, Pencil, ToggleLeft, ToggleRight, Trash2, Users } from "lucide-react";

type ChainSummary = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  stageCount: number;
  userCount: number;
  certificationCode: string | null;
};

type Props = {
  chain: ChainSummary;
  onEdit: () => void;
  onManageStages: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
};

export function TrailChainCard({ chain, onEdit, onManageStages, onToggleActive, onDelete }: Props) {
  return (
    <div
      className={`flex flex-col border bg-[#0a1020] transition-colors hover:bg-[#0d1628] ${
        chain.active ? "border-[#1e293b]" : "border-[#1e293b] opacity-50"
      }`}
    >
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-xs font-bold leading-snug text-[#e2e8f0] line-clamp-2">{chain.name}</p>
          <span
            className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase ${
              chain.active
                ? "border-green-700 bg-green-900/60 text-green-400"
                : "border-[#334155] bg-[#0f172a]/80 text-[#64748b]"
            }`}
          >
            {chain.active ? "Ativa" : "Inativa"}
          </span>
        </div>

        {chain.description && (
          <p className="font-[var(--font-body)] text-xs text-[#94a3b8] line-clamp-2">{chain.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {chain.certificationCode && (
            <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#94a3b8]">
              {chain.certificationCode}
            </span>
          )}
          <span className="flex items-center gap-1 border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#f97316]">
            <ListTree size={10} />
            {chain.stageCount} estagio{chain.stageCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1 border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] text-[#64748b]">
            <Users size={10} />
            {chain.userCount}
          </span>
        </div>
      </div>

      <button
        onClick={onManageStages}
        className="flex items-center justify-center gap-1.5 border-t border-[#1e293b] px-3 py-2 text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30"
      >
        <ListTree size={12} />
        Gerenciar estagios
      </button>

      {/* Actions */}
      <div className="flex border-t border-[#1e293b]">
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase text-[#94a3b8] hover:bg-[#1e293b]/50"
          title="Editar"
        >
          <Pencil size={12} />
          Editar
        </button>
        <button
          onClick={onToggleActive}
          className="flex flex-1 items-center justify-center gap-1.5 border-x border-[#1e293b] px-3 py-2 text-[10px] uppercase text-[#94a3b8] hover:bg-[#1e293b]/50"
          title={chain.active ? "Desativar" : "Ativar"}
        >
          {chain.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
          {chain.active ? "Desativar" : "Ativar"}
        </button>
        <button
          onClick={onDelete}
          className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[9px] uppercase text-red-400 hover:bg-red-900/20"
          title="Deletar"
        >
          <Trash2 size={12} />
          Deletar
        </button>
      </div>
    </div>
  );
}
