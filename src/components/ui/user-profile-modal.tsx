"use client";

import { useEffect, useState } from "react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { UserProfile } from "@/lib/types";

export function UserProfileModal({
  profile,
  onSave,
  open,
  onClose,
  certificationOptions,
  currentUsername,
}: {
  profile: UserProfile;
  onSave: (profile: UserProfile) => Promise<void>;
  open: boolean;
  onClose: () => void;
  certificationOptions: Array<{ id: string; code: string; name: string }>;
  currentUsername: string;
}) {
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  useEffect(() => {
    if (!open) return;

    setDraft(profile);
    setFormError(null);
    setUsernameStatus("idle");
  }, [open, profile]);

  async function validateUsername(nextUsername: string): Promise<boolean> {
    const normalized = nextUsername.trim().toLowerCase();
    const current = currentUsername.trim().toLowerCase();

    if (!normalized) {
      setUsernameStatus("invalid");
      setFormError("Informe um nome de usuario valido.");
      return false;
    }

    if (normalized === current) {
      setUsernameStatus("available");
      setFormError(null);
      return true;
    }

    setUsernameStatus("checking");
    const response = await fetch(`/api/user/username?value=${encodeURIComponent(normalized)}`);
    const data = (await response.json()) as { available?: boolean; error?: string };

    if (!response.ok || !data.available) {
      setUsernameStatus(data.error === "Formato invalido." ? "invalid" : "taken");
      setFormError(data.error ?? "Nome de usuario indisponivel.");
      return false;
    }

    setUsernameStatus("available");
    setFormError(null);
    return true;
  }

  async function handleSave() {
    setFormError(null);

    if (!draft.name.trim() || !draft.favoriteTheme.trim() || !draft.certificationPresetCode.trim()) {
      setFormError("Preencha nome, certificacao alvo e tema favorito.");
      return;
    }

    const validUsername = await validateUsername(draft.username);
    if (!validUsername) {
      return;
    }

    setSaving(true);

    try {
      await onSave({
        ...draft,
        username: draft.username.trim().toLowerCase(),
      });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

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
          Nome de usuario
          <div className="mt-1 flex gap-2">
            <input
              className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] lowercase"
              value={draft.username}
              onBlur={() => {
                void validateUsername(draft.username);
              }}
              onChange={(e) => {
                setDraft({ ...draft, username: e.target.value });
                setUsernameStatus("idle");
              }}
              placeholder="ex: cloud_runner_123"
            />
            <PixelButton
              type="button"
              variant="ghost"
              onClick={async () => {
                const response = await fetch("/api/user/username", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ random: true }),
                });

                const data = (await response.json()) as { username?: string; error?: string };
                if (!response.ok || !data.username) {
                  setFormError(data.error ?? "Nao foi possivel gerar username.");
                  return;
                }

                setDraft({ ...draft, username: data.username });
                setUsernameStatus("available");
                setFormError(null);
              }}
            >
              Gerar
            </PixelButton>
          </div>
          <p className="mt-1 font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">
            {usernameStatus === "checking" && "Validando username..."}
            {usernameStatus === "available" && "Username disponivel."}
            {usernameStatus === "taken" && "Username indisponivel."}
            {usernameStatus === "invalid" && "Formato invalido para username."}
            {usernameStatus === "idle" && "Use de 3 a 24 caracteres: letras, numeros ou _."}
          </p>
        </label>
        <label className="block text-sm">
          Certificacao AWS alvo
          <select
            className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)]"
            value={draft.certificationPresetCode}
            onChange={(e) => {
              const code = e.target.value;
              const selected = certificationOptions.find((option) => option.code === code);

              setDraft({
                ...draft,
                certificationPresetCode: code,
                certification: selected?.name ?? "",
              });
            }}
          >
            <option value="">Selecione uma certificacao</option>
            {certificationOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Tema favorito
          <input
            className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)]"
            value={draft.favoriteTheme}
            onChange={(e) => setDraft({ ...draft, favoriteTheme: e.target.value })}
          />
        </label>

        {formError && (
          <PixelCard className="border-red-500 bg-red-900/20 py-2">
            <p className="font-[var(--font-body)] text-sm text-red-300">{formError}</p>
          </PixelCard>
        )}

        <div className="flex justify-end gap-2">
          <PixelButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </PixelButton>
          <PixelButton onClick={handleSave} disabled={saving || usernameStatus === "checking"}>
            {saving ? "Salvando..." : "Salvar"}
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
}
