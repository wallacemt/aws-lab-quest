"use client";

import { useEffect, useRef, useState } from "react";

type CertificationOption = { id: string; code: string; name: string };

type CertBadge = {
  id: string;
  badgeUrl: string;
  earnedAt: string;
  certificationPreset: { code: string; name: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onBadgeAdded?: (badge: CertBadge) => void;
  certificationOptions: CertificationOption[];
};

type ModalState = "form" | "celebration" | "next-cert";

function playSuccessSound() {
  try {
    const ctx = new AudioContext();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
      osc.frequency.value = freq;
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.35);
    });
  } catch {
    // Web Audio API not available
  }
}

async function triggerConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, zIndex: 9999 });
    setTimeout(() => confetti({ particleCount: 70, spread: 130, origin: { x: 0.1, y: 0.5 }, zIndex: 9999 }), 350);
    setTimeout(() => confetti({ particleCount: 70, spread: 130, origin: { x: 0.9, y: 0.5 }, zIndex: 9999 }), 600);
  } catch {
    // canvas-confetti not available
  }
}

export function CertificationAchievementModal({ open, onClose, onBadgeAdded, certificationOptions }: Props) {
  const [state, setState] = useState<ModalState>("form");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [certPresetId, setCertPresetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBadge, setLastBadge] = useState<CertBadge | null>(null);
  const [achievementUnlocked, setAchievementUnlocked] = useState(false);
  const confettiFiredRef = useRef(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setState("form");
      setBadgeUrl("");
      setCertPresetId("");
      setError(null);
      setLastBadge(null);
      setAchievementUnlocked(false);
      confettiFiredRef.current = false;
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    }
  }, [open]);

  useEffect(() => {
    if (state === "celebration" && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      playSuccessSound();
      void triggerConfetti();
      autoAdvanceRef.current = setTimeout(() => setState("next-cert"), 4000);
    }
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [state]);

  if (!open) return null;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/user/cert-badges", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeUrl, certificationPresetId: certPresetId || null }),
      });
      const data = (await res.json()) as { badge?: CertBadge; achievementUnlocked?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao registrar.");
      setLastBadge(data.badge ?? null);
      setAchievementUnlocked(data.achievementUnlocked ?? false);
      if (data.badge) onBadgeAdded?.(data.badge);
      setState("celebration");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar certificacao.");
    } finally {
      setSubmitting(false);
    }
  }

  const certName = lastBadge?.certificationPreset?.name ?? certificationOptions.find((c) => c.id === certPresetId)?.name ?? "certificacao";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <div className="w-full max-w-md space-y-5 rounded border border-[#334155] bg-[#111827] p-6 text-[#e2e8f0]">

        {/* Form state */}
        {state === "form" && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[#f97316]">Certificacao Alcancada</p>
                <p className="mt-1 text-sm text-[#94a3b8]">Parabens! Registre sua conquista.</p>
              </div>
              <button type="button" onClick={onClose} className="border border-[#334155] px-3 py-1 text-xs uppercase">
                Fechar
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase text-[#94a3b8]">Link do badge (Credly, AWS, LinkedIn...)</span>
              <input
                type="url"
                value={badgeUrl}
                onChange={(e) => setBadgeUrl(e.target.value)}
                placeholder="https://www.credly.com/badges/..."
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase text-[#94a3b8]">Qual certificacao voce obteve? (opcional)</span>
              <select
                value={certPresetId}
                onChange={(e) => setCertPresetId(e.target.value)}
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
              >
                <option value="">Selecionar certificacao</option>
                {certificationOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </label>

            {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-3">
              <button type="button" onClick={onClose} className="border border-[#334155] px-4 py-2 text-xs uppercase">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !badgeUrl.trim()}
                className="border border-[#14532d] bg-green-900/20 px-4 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
              >
                {submitting ? "Registrando..." : "Registrar conquista"}
              </button>
            </div>
          </>
        )}

        {/* Celebration state */}
        {state === "celebration" && (
          <div className="space-y-5 text-center">
            <p className="text-4xl">🏆</p>
            <div>
              <p className="font-mono text-xs uppercase text-[#f97316]">Incrivel!</p>
              <p className="mt-2 text-lg font-semibold text-[#e2e8f0]">
                Voce conquistou a {certName}!
              </p>
            </div>
            {achievementUnlocked && (
              <div className="rounded border border-[#7c2d12]/50 bg-[#0b1220] px-4 py-3">
                <p className="font-mono text-xs uppercase text-amber-400">Conquista desbloqueada!</p>
                <p className="mt-1 text-sm text-[#e2e8f0]">Certificado Real</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); setState("next-cert"); }}
                className="flex-1 border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8]"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-[#1d4ed8] bg-blue-900/20 px-4 py-2 text-xs uppercase text-blue-300"
              >
                Ver no perfil
              </button>
            </div>
          </div>
        )}

        {/* Next cert state */}
        {state === "next-cert" && (
          <div className="space-y-5">
            <div>
              <p className="font-mono text-xs uppercase text-[#f97316]">Proxima meta</p>
              <p className="mt-2 text-sm text-[#cbd5e1]">Ja tem uma nova certificacao na mira?</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setTimeout(() => {
                    document.getElementById("edit-profile-btn")?.click();
                  }, 100);
                }}
                className="w-full border border-[#1d4ed8] bg-blue-900/20 px-4 py-2 text-xs uppercase text-blue-300"
              >
                Sim, definir nova meta de certificacao
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8]"
              >
                Nao, estou curtindo por agora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
