"use client";

import { useRef, useState } from "react";
import { compressImageToDataUrl, validateImageFile } from "@/lib/image-utils";

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
};

export function ArtworkUploadField({ value, onChange, label = "Arte do pack" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const validationError = validateImageFile(file);
    if (validationError) { setError(validationError); return; }

    setError(null);
    setProcessing(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar imagem");
    } finally {
      setProcessing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <span className="text-xs uppercase text-[#64748b]">{label} (opcional)</span>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative border border-dashed border-[#334155] bg-[#0b1220]"
      >
        {value ? (
          <div className="relative">
            <img
              src={value}
              alt="Arte do pack"
              className="h-36 w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-opacity hover:bg-black/50 hover:opacity-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="border border-[#334155] bg-[#0f172a] px-3 py-1.5 text-[10px] uppercase text-[#e2e8f0]"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="border border-red-800 bg-red-900/30 px-3 py-1.5 text-[10px] uppercase text-red-300"
              >
                Remover
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className="flex h-24 w-full flex-col items-center justify-center gap-1 text-center"
          >
            {processing ? (
              <span className="text-xs text-[#64748b]">Processando...</span>
            ) : (
              <>
                <span className="text-2xl text-[#334155]">🖼</span>
                <span className="text-[10px] uppercase text-[#64748b]">Clique ou arraste uma imagem</span>
                <span className="text-[10px] text-[#475569]">PNG, JPG, WebP · max 3MB · comprimida para 640px</span>
              </>
            )}
          </button>
        )}
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
