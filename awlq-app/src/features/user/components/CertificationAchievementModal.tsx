"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type CertificationOption = { id: string; code: string; name: string };

type CertBadge = {
  id: string;
  badgeUrl: string;
  badgeImageUrl: string | null;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBadge, setLastBadge] = useState<CertBadge | null>(null);
  const [achievementUnlocked, setAchievementUnlocked] = useState(false);
  const confettiFiredRef = useRef(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setState("form");
      setBadgeUrl("");
      setCertPresetId("");
      setImageFile(null);
      setImagePreview(null);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Imagem deve ser JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Imagem deve ter no maximo 4 MB.");
      return;
    }

    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      let uploadedImageUrl: string | null = null;

      if (imageFile) {
        setUploadingImage(true);
        const fd = new FormData();
        fd.append("image", imageFile);
        const uploadRes = await fetch("/api/user/badge-image", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const uploadData = (await uploadRes.json()) as { imageUrl?: string; error?: string };
        if (!uploadRes.ok) throw new Error(uploadData.error ?? "Falha ao enviar imagem.");
        uploadedImageUrl = uploadData.imageUrl ?? null;
        setUploadingImage(false);
      }

      const res = await fetch("/api/user/cert-badges", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badgeUrl,
          certificationPresetId: certPresetId || null,
          badgeImageUrl: uploadedImageUrl,
        }),
      });
      const data = (await res.json()) as { badge?: CertBadge; achievementUnlocked?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao registrar.");
      setLastBadge(data.badge ?? null);
      setAchievementUnlocked(data.achievementUnlocked ?? false);
      if (data.badge) onBadgeAdded?.(data.badge);
      setState("celebration");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar certificacao.");
      setUploadingImage(false);
    } finally {
      setSubmitting(false);
    }
  }

  const certName =
    lastBadge?.certificationPreset?.name ??
    certificationOptions.find((c) => c.id === certPresetId)?.name ??
    "certificacao";

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

            {/* Badge image upload */}
            <div className="space-y-2">
              <p className="text-xs uppercase text-[#94a3b8]">Imagem do badge (opcional)</p>
              {imagePreview ? (
                <div className="relative flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-amber-500/40 bg-[#0b1220]">
                    <Image
                      src={imagePreview}
                      alt="Preview do badge"
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-[#e2e8f0]">{imageFile?.name}</p>
                    <p className="font-mono text-[10px] text-[#64748b]">
                      {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="mt-1 border border-[#7f1d1d] px-2 py-0.5 font-mono text-[10px] text-red-400 hover:bg-red-900/20"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-[#334155] py-4 text-center font-mono text-xs uppercase text-[#64748b] transition-colors hover:border-amber-500/50 hover:text-amber-400"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Anexar imagem do badge
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
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
                {uploadingImage ? "Enviando imagem..." : submitting ? "Registrando..." : "Registrar conquista"}
              </button>
            </div>
          </>
        )}

        {/* Celebration state */}
        {state === "celebration" && (
          <div className="space-y-5 text-center">
            {lastBadge?.badgeImageUrl ? (
              <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-2 border-amber-500/60 bg-[#0b1220] p-2 shadow-lg shadow-amber-900/30">
                <Image
                  src={lastBadge.badgeImageUrl}
                  alt={certName}
                  width={96}
                  height={96}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <p className="text-4xl">🏆</p>
            )}
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
