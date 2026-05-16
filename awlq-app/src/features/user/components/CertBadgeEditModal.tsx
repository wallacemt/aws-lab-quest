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
  badge: CertBadge | null;
  certificationOptions: CertificationOption[];
  onClose: () => void;
  onSaved: (badge: CertBadge) => void;
  onDeleted: (badgeId: string) => void;
};

export function CertBadgeEditModal({ badge, certificationOptions, onClose, onSaved, onDeleted }: Props) {
  const [badgeUrl, setBadgeUrl] = useState("");
  const [certPresetId, setCertPresetId] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Populate form when badge changes
  useEffect(() => {
    if (!badge) return;
    setBadgeUrl(badge.badgeUrl);
    const presetId = certificationOptions.find(
      (c) => c.code === badge.certificationPreset?.code,
    )?.id ?? "";
    setCertPresetId(presetId);
    setCurrentImageUrl(badge.badgeImageUrl);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setConfirmDelete(false);
    setError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, [badge, certificationOptions]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  if (!badge) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { setError("Imagem deve ser JPEG, PNG ou WebP."); return; }
    if (file.size > 4 * 1024 * 1024) { setError("Imagem deve ter no maximo 4 MB."); return; }
    setError(null);
    setRemoveImage(false);
    setImageFile(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setImagePreview(url);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!badge) return;
    setError(null);
    setSaving(true);
    try {
      let uploadedImageUrl: string | undefined;

      if (imageFile) {
        setUploadingImage(true);
        const fd = new FormData();
        fd.append("image", imageFile);
        const res = await fetch("/api/user/badge-image", { method: "POST", credentials: "include", body: fd });
        const data = (await res.json()) as { imageUrl?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Falha ao enviar imagem.");
        uploadedImageUrl = data.imageUrl;
        setUploadingImage(false);
      }

      const body: Record<string, unknown> = {
        badgeUrl,
        certificationPresetId: certPresetId || null,
      };

      if (removeImage) {
        body.removeImage = true;
      } else if (uploadedImageUrl) {
        body.badgeImageUrl = uploadedImageUrl;
      }

      const res = await fetch(`/api/user/cert-badges/${badge.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { badge?: CertBadge; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
      if (data.badge) onSaved(data.badge);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
      setUploadingImage(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!badge) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/cert-badges/${badge.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Falha ao excluir.");
      }
      onDeleted(badge.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setDeleting(false);
    }
  }

  // Which image to show in the preview area
  const displayImage = removeImage ? null : (imagePreview ?? currentImageUrl);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <div className="w-full max-w-md space-y-5 border border-[#334155] bg-[#111827] p-6 text-[#e2e8f0]">

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-[#f97316]">Editar Certificacao</p>
            <p className="mt-1 text-sm text-[#94a3b8]">
              {badge.certificationPreset?.name ?? "Certificacao AWS"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="border border-[#334155] px-3 py-1 text-xs uppercase">
            Fechar
          </button>
        </div>

        {/* Image section */}
        <div className="space-y-2">
          <p className="text-xs uppercase text-[#94a3b8]">Imagem do badge</p>
          {displayImage ? (
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-amber-500/40 bg-[#0b1220]">
                <Image
                  src={displayImage}
                  alt="Badge"
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-amber-500/50 hover:text-amber-400"
                >
                  Trocar imagem
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="border border-[#7f1d1d] px-3 py-1 font-mono text-[10px] uppercase text-red-400 hover:bg-red-900/20"
                >
                  Remover imagem
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-[#334155] py-4 font-mono text-xs uppercase text-[#64748b] transition-colors hover:border-amber-500/50 hover:text-amber-400"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              {currentImageUrl && removeImage ? "Sem imagem (removida)" : "Anexar imagem"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          {imageFile && (
            <p className="font-mono text-[10px] text-[#64748b]">
              {imageFile.name} · {(imageFile.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>

        {/* Badge URL */}
        <label className="block space-y-1">
          <span className="text-xs uppercase text-[#94a3b8]">Link do badge</span>
          <input
            type="url"
            value={badgeUrl}
            onChange={(e) => setBadgeUrl(e.target.value)}
            placeholder="https://www.credly.com/badges/..."
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
          />
        </label>

        {/* Certification select */}
        <label className="block space-y-1">
          <span className="text-xs uppercase text-[#94a3b8]">Certificacao</span>
          <select
            value={certPresetId}
            onChange={(e) => setCertPresetId(e.target.value)}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
          >
            <option value="">Nenhuma selecionada</option>
            {certificationOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

        {/* Actions */}
        <div className="space-y-2 border-t border-[#1e293b] pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !badgeUrl.trim()}
              className="flex-1 border border-[#14532d] bg-green-900/20 px-4 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
            >
              {uploadingImage ? "Enviando imagem..." : saving ? "Salvando..." : "Salvar alteracoes"}
            </button>
          </div>

          {/* Delete zone */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full border border-[#7f1d1d]/50 px-4 py-2 font-mono text-xs uppercase text-red-500/70 transition-colors hover:border-[#7f1d1d] hover:bg-red-900/10 hover:text-red-400"
            >
              Excluir certificacao
            </button>
          ) : (
            <div className="space-y-2 border border-[#7f1d1d]/40 bg-red-900/10 p-3">
              <p className="font-mono text-[10px] text-red-400">
                Tem certeza? Esta acao nao pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 border border-[#334155] px-3 py-1.5 text-xs uppercase text-[#94a3b8]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="flex-1 border border-[#7f1d1d] bg-red-900/20 px-3 py-1.5 text-xs uppercase text-red-300 disabled:opacity-60"
                >
                  {deleting ? "Excluindo..." : "Confirmar exclusao"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
