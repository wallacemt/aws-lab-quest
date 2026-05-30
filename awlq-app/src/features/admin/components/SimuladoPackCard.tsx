"use client";

import Image from "next/image";
import { Pencil, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

type SimuladoPackItem = {
  id: string;
  name: string;
  certificationCode: string | null;
  certificationName: string | null;
  questionCount: number;
  difficultyScore: number;
  active: boolean;
  artworkUrl: string | null;
  createdAt: string;
  createdByName: string | null;
  sessionCount: number;
};

type Props = {
  pack: SimuladoPackItem;
  onEdit: (id: string) => void;
  onToggleActive: (pack: SimuladoPackItem) => void;
  onDelete: (id: string) => void;
};

export function SimuladoPackCard({ pack, onEdit, onToggleActive, onDelete }: Props) {
  return (
    <div
      className={`flex flex-col border bg-[#0a1020] transition-colors hover:bg-[#0d1628] ${
        pack.active ? "border-[#1e293b]" : "border-[#1e293b] opacity-50"
      }`}
    >
      {/* Artwork */}
      <div className="relative h-36 w-full overflow-hidden bg-[#111827]">
        {pack.artworkUrl ? (
          pack.artworkUrl.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pack.artworkUrl} alt={pack.name} className="h-full w-full object-cover" />
          ) : (
            <Image src={pack.artworkUrl} alt={pack.name} fill sizes="300px" className="object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-mono text-3xl font-bold text-[#334155]">
              {pack.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute right-2 top-2">
          <span
            className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${
              pack.active ? "border-green-700 bg-green-900/60 text-green-400" : "border-[#334155] bg-[#0f172a]/80 text-[#64748b]"
            }`}
          >
            {pack.active ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="font-mono text-xs font-bold leading-snug text-[#e2e8f0] line-clamp-2">{pack.name}</p>

        <div className="flex flex-wrap gap-1.5">
          {pack.certificationCode && (
            <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#94a3b8]">
              {pack.certificationCode}
            </span>
          )}
          <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#94a3b8]">
            {pack.questionCount}q
          </span>
          <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#f97316]">
            {pack.difficultyScore === 10 ? "BOSS" : `${pack.difficultyScore}/10`}
          </span>
          <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[9px] text-[#64748b]">
            {pack.sessionCount} sessoes
          </span>
        </div>

        <p className="font-mono text-[9px] text-[#475569]">
          {new Date(pack.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex border-t border-[#1e293b]">
        <button
          onClick={() => onEdit(pack.id)}
          className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase text-[#38bdf8] hover:bg-[#1e3a5f]/30"
          title="Editar"
        >
          <Pencil size={12} />
          Editar
        </button>
        <button
          onClick={() => onToggleActive(pack)}
          className="flex flex-1 items-center justify-center gap-1.5 border-x border-[#1e293b] px-3 py-2 text-[10px] uppercase text-[#94a3b8] hover:bg-[#1e293b]/50"
          title={pack.active ? "Desativar" : "Ativar"}
        >
          {pack.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
          {pack.active ? "Desativar" : "Ativar"}
        </button>
        <button
          onClick={() => onDelete(pack.id)}
          className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[10px] uppercase text-red-400 hover:bg-red-900/20"
          title="Excluir"
        >
          <Trash2 size={12} />
          Excluir
        </button>
      </div>
    </div>
  );
}
