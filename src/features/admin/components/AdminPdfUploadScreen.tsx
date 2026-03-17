"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";

type CertificationOption = {
  id: string;
  code: string;
  name: string;
};

type ExtractionResponse = {
  fileName: string;
  characters: number;
  preview: string;
  extractedText: string;
  certification: {
    code: string;
    name: string;
  };
};

type IngestResponse = {
  certificationCode: string;
  generatedCount: number;
  savedCount: number;
};

export function AdminPdfUploadScreen() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResponse | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null);
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [selectedCertificationCode, setSelectedCertificationCode] = useState("");

  useEffect(() => {
    async function loadCertifications() {
      try {
        const response = await fetch("/api/certifications", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { certifications?: CertificationOption[] };
        const options = payload.certifications ?? [];
        setCertifications(options);

        if (options.length > 0) {
          setSelectedCertificationCode(options[0].code);
        }
      } catch {
        // Keep UI usable even if presets fail to load.
      }
    }

    void loadCertifications();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIngestResult(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Selecione um PDF antes de continuar.");
      return;
    }

    if (!selectedCertificationCode) {
      setError("Selecione a certificacao alvo para continuar.");
      return;
    }

    formData.set("certificationCode", selectedCertificationCode);

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

  async function handleIngest() {
    if (!result) {
      return;
    }

    setSaving(true);
    setError(null);
    setIngestResult(null);

    try {
      const response = await fetch("/api/admin/pdf/ingest", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          certificationCode: result.certification.code,
          extractedText: result.extractedText,
          desiredCount: 20,
        }),
      });

      const payload = (await response.json()) as IngestResponse | { error: string };
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error : "Falha ao salvar questoes no banco.");
        return;
      }

      setIngestResult(payload);
    } catch {
      setError("Erro inesperado ao salvar questoes geradas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <PixelCard className="space-y-3">
        <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">Admin OCR</p>
        <h1 className="font-[var(--font-pixel)] text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
          Upload de PDF de simulado
        </h1>
        <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
          Etapa 1 do pipeline: extrair texto bruto do PDF para revisao antes da geracao de questoes via IA.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin">
            <PixelButton variant="ghost">Voltar</PixelButton>
          </Link>
          <Link href="/admin/questions">
            <PixelButton variant="ghost">Ver banco de questoes</PixelButton>
          </Link>
        </div>
      </PixelCard>

      <PixelCard>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
              Certificacao alvo
            </span>
            <select
              name="certificationCode"
              value={selectedCertificationCode}
              onChange={(event) => setSelectedCertificationCode(event.target.value)}
              className="w-full rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
              required
            >
              {certifications.length === 0 && <option value="">Carregando certificacoes...</option>}
              {certifications.map((certification) => (
                <option key={certification.id} value={certification.code}>
                  {certification.code} - {certification.name}
                </option>
              ))}
            </select>
          </label>

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

            {result && (
              <PixelButton type="button" disabled={saving} onClick={handleIngest}>
                {saving ? "Salvando questoes..." : "Gerar e salvar questoes"}
              </PixelButton>
            )}
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
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">Preview extraido</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Arquivo: {result.fileName} | Certificacao: {result.certification.code} | Caracteres: {result.characters}
          </p>
          <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-xs leading-5 text-[var(--pixel-text)]">
            {result.preview}
          </pre>
        </PixelCard>
      )}

      {ingestResult && (
        <PixelCard className="space-y-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">
            Ingestao concluida
          </p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Certificacao: {ingestResult.certificationCode} | Geradas: {ingestResult.generatedCount} | Salvas:{" "}
            {ingestResult.savedCount}
          </p>
        </PixelCard>
      )}
    </main>
  );
}
