"use client";

import Link from "next/link";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { useAdminPdfUpload } from "@/features/admin/hooks/useAdminPdfUpload";

export function AdminPdfUploadScreen() {
  const {
    certifications,
    selectedCertificationCode,
    setSelectedCertificationCode,
    loading,
    error,
    result,
    handleSubmit,
  } = useAdminPdfUpload();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <PixelCard className="space-y-3">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Admin Ingestion</p>
        <h1 className="font-mono text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
          Upload de questoes (PDF ou Markdown)
        </h1>
        <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
          Fluxo unico: envie arquivos, clique em processar e visualize as questoes extraidas.
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
            <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Certificacao</span>
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
            <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Arquivos</span>
            <input
              type="file"
              name="files"
              accept="application/pdf,.pdf,text/markdown,.md,text/plain"
              multiple
              className="w-full rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
              required
            />
            <p className="text-xs text-[var(--pixel-subtext)]">
              Tipos suportados: PDF (texto selecionavel) e Markdown.
            </p>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <PixelButton type="submit" disabled={loading}>
              {loading ? "Processando..." : "Processar"}
            </PixelButton>
            {loading && <p className="text-xs text-[var(--pixel-subtext)]">Executando pipeline de ingestao...</p>}
          </div>
        </form>
      </PixelCard>

      {error && (
        <PixelCard className="border-[var(--pixel-danger)] bg-[var(--pixel-danger)]/10">
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{error}</p>
        </PixelCard>
      )}

      {result && (
        <PixelCard className="space-y-4 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Ingestao concluida</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Certificacao: {result.certificationCode} | Geradas: {result.generatedCount} | Salvas: {result.savedCount} |
            Duplicadas: {result.duplicateCount ?? 0} | Rejeitadas: {result.rejectedCount ?? 0}
          </p>

          {result.rejects && result.rejects.length > 0 && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Rejeicoes</p>
              <div className="max-h-40 space-y-2 overflow-auto rounded border border-[var(--pixel-border)] p-2 text-xs">
                {result.rejects.map((reject, index) => (
                  <div key={`${reject.fileName}-${reject.blockId ?? "x"}-${index}`}>
                    <p className="font-mono uppercase text-[var(--pixel-text)]">
                      {reject.fileName} | bloco {reject.blockId ?? "n/a"} | {reject.reason}
                    </p>
                    <p className="text-[var(--pixel-subtext)]">{reject.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
              Preview das questoes extraidas
            </p>
            {!result.extractedQuestions || result.extractedQuestions.length === 0 ? (
              <p className="text-sm text-[var(--pixel-subtext)]">Nenhuma questao validada para preview.</p>
            ) : (
              <div className="space-y-3">
                {result.extractedQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="space-y-2 rounded border border-[var(--pixel-border)] bg-black/5 p-3"
                  >
                    <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                      {question.usageHash.slice(0, 12)}
                    </p>
                    <p className="text-sm text-[var(--pixel-text)]">{question.statement}</p>
                    <div className="space-y-1 text-xs text-[var(--pixel-text)]">
                      {question.options.map((option, index) => (
                        <p key={`${question.id}-${index}`}>
                          {String.fromCharCode(65 + index)}) {option.content}
                          {option.isCorrect ? " (correta)" : ""}
                        </p>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--pixel-subtext)]">
                      Servicos: {question.awsServices.join(", ") || "-"} | Topicos: {question.topics.join(", ") || "-"}
                    </p>
                    {question.explanation && (
                      <p className="text-xs text-[var(--pixel-subtext)]">Explicacao: {question.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </PixelCard>
      )}
    </main>
  );
}
