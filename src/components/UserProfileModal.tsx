"use client";

import { useState } from "react";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { UserProfile } from "@/lib/types";

export function UserProfileModal({
  profile,
  onSave,
  open,
  onClose,
}: {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<UserProfile>(profile);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <PixelCard className="w-full max-w-xl space-y-4">
        <h2 className="font-[var(--font-pixel)] text-xs uppercase">Perfil do Jogador</h2>
        <label className="block text-sm">
          Nome
          <input
            className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)]"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Certificacao AWS alvo
          <input
            className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)]"
            value={draft.certification}
            onChange={(e) => setDraft({ ...draft, certification: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Tema favorito
          <input
            className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)]"
            value={draft.favoriteTheme}
            onChange={(e) => setDraft({ ...draft, favoriteTheme: e.target.value })}
          />
        </label>
        <div className="flex justify-end gap-2">
          <PixelButton variant="ghost" onClick={onClose}>
            Cancelar
          </PixelButton>
          <PixelButton
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Salvar
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
}
