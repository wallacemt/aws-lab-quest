"use client";

import { useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";

type ExtractionResponse = {
  fileName: string;
  characters: number;
  preview: string;
  extractedText: string;
};

export function AdminPdfUploadScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResponse | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Selecione um PDF antes de continuar.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/pdf/extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const payload = (await response.json()) as ExtractionResponse | { error: string };
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error : "Falha ao processar PDF.");
        return;
      }

      setResult(payload);
    } catch {
      setError("Erro inesperado ao enviar PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard className="space-y-3">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">Admin OCR</p>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
            Upload de PDF de simulado
          </h1>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Etapa 1 do pipeline: extrair texto bruto do PDF para revisao antes da geracao de questoes via IA.
          </p>
          <div>
            <Link href="/admin">
              <PixelButton>Voltar ao painel admin</PixelButton>
            </Link>
          </div>
        </PixelCard>

        <PixelCard>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
                Arquivo PDF
              </span>
              <input
                type="file"
                name="file"
                accept="application/pdf,.pdf"
                className="w-full rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <PixelButton type="submit" disabled={loading}>
                {loading ? "Processando..." : "Extrair texto"}
              </PixelButton>
            </div>
          </form>
        </PixelCard>

        {error && (
          <PixelCard className="border-[var(--pixel-danger)] bg-[var(--pixel-danger)]/10">
            <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{error}</p>
          </PixelCard>
        )}

        {result && (
          <PixelCard className="space-y-3">
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
              Preview extraido
            </p>
            <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
              Arquivo: {result.fileName} | Caracteres: {result.characters}
            </p>
            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-xs leading-5 text-[var(--pixel-text)]">
              {result.preview}
            </pre>
          </PixelCard>
        )}
      </main>
    </AppLayout>
  );
}
