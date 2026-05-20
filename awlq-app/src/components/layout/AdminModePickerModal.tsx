"use client";

import { AdminMode } from "@/stores/adminModeStore";

type Props = {
  onSelect: (mode: AdminMode) => void;
  userName?: string;
};

export function AdminModePickerModal({ onSelect, userName }: Props) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          {userName && (
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)] tracking-widest">
              Bem-vindo, {userName}
            </p>
          )}
          <h1 className="font-mono text-base uppercase tracking-widest text-[var(--pixel-primary)]">
            Como quer acessar?
          </h1>
          <p className="text-xs text-[#64748b]">Esta escolha sera lembrada. Voce pode trocar a qualquer momento.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onSelect("admin")}
            className="group flex flex-col items-center gap-4 border-2 border-[#f97316]/60 bg-[#0f0700] px-4 py-8 text-center transition-all hover:border-[#f97316] hover:bg-[#f97316]/10 active:scale-95"
          >
            <span className="text-4xl transition-transform group-hover:scale-110" aria-hidden>
              🛡️
            </span>
            <div className="space-y-1">
              <p className="font-mono text-xs font-bold uppercase text-[#f97316]">Painel Admin</p>
              <p className="text-[10px] leading-relaxed text-[#64748b]">
                Gerencie usuarios, questoes e configuracoes do sistema
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect("user")}
            className="group flex flex-col items-center gap-4 border-2 border-[#38bdf8]/60 bg-[#00060f] px-4 py-8 text-center transition-all hover:border-[#38bdf8] hover:bg-[#38bdf8]/10 active:scale-95"
          >
            <span className="text-4xl transition-transform group-hover:scale-110" aria-hidden>
              🎮
            </span>
            <div className="space-y-1">
              <p className="font-mono text-xs font-bold uppercase text-[#38bdf8]">Modo Jogador</p>
              <p className="text-[10px] leading-relaxed text-[#64748b]">
                Explore o app, complete labs e compete no ranking
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
