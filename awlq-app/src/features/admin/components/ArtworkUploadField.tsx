"use client";

import Image from "next/image";
import { FileImage } from "lucide-react";
import { useState } from "react";
import { compressImageToDataUrl, validateImageFile } from "@/lib/image-utils";
import { FileDropzone } from "./FileDropzone";

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
};

export function ArtworkUploadField({ value, onChange, label = "Arte do pack" }: Props) {
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

  return (
    <FileDropzone label={`${label} (opcional)`} accept="image/*" hint="PNG, JPG ou WebP · até 3 MB · comprimida para 640 px" busy={processing} error={error} onFile={file => void handleFile(file)}>
      {({ openFilePicker }) => value ? (
          <div className="relative h-36">
            {value.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Arte do pack" className="h-full w-full object-cover" />
            ) : (
              <Image src={value} alt="Arte do pack" fill sizes="640px" className="object-cover" />
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8">
              <button
                type="button"
                onClick={openFilePicker}
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
            onClick={openFilePicker}
            disabled={processing}
            className="flex min-h-36 w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#19e26d]"
          >
            {processing ? (
              <span className="text-xs text-[#94a3b8]">Processando imagem…</span>
            ) : (
              <>
                <span className="grid size-11 place-items-center border border-[#334155] bg-[#111c2e] text-[#19e26d]"><FileImage size={21} /></span>
                <span className="text-xs font-medium text-[#e2e8f0]">Solte a imagem aqui</span>
                <span className="text-xs text-[#94a3b8]">ou <span className="text-[#19e26d] underline underline-offset-4">escolha no dispositivo</span></span>
              </>
            )}
          </button>
        )}
      
    </FileDropzone>
  );
}
