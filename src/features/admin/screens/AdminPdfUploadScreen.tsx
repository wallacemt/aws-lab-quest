"use client";

import Link from "next/link";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";

import { formatBytes, formatDate, inferQuestionCountFromText } from "../utils";
import { useAdminPdfUpload } from "../hooks/useAdminPdfUpload";

export function AdminPdfUploadScreen() {
  const {
    guideStatuses,
    simuladoResult,
    selectedCertificationCode,
    reloadAdminUploadData,
    setSelectedCertificationCode,
    resetStatus,
    certifications,
    startAction,
    showUploadActions,
    setShowFlowHelp,
    setShowUploadActions,
    setManualExamGuideText,
    handleCancelActiveProcessing,
    handleSubmit,
    loading,
    manualExamGuideText,
    mode,
    saving,
    handleIngest,
    activeJobId,
    cancelRequested,
    overwriteExamGuide,
    setOverwriteExamGuide,
    jobSnapshot,
    simuladoQueue,
    error,
    warning,
    examGuideResult,
    ingestResult,
    uploadDashboard,
    setAuditPage,
    setAuditFileId,
    auditPayload,
    auditLoading,
    auditError,
    auditFileId,
    showFlowHelp,
    closeAudit,
  } = useAdminPdfUpload();
  const selectedGuideStatus = guideStatuses.find((guideStatus) => guideStatus.code === selectedCertificationCode);
  const estimatedExtractedQuestions = simuladoResult ? inferQuestionCountFromText(simuladoResult.extractedText) : 0;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <PixelCard className="space-y-3">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Admin OCR</p>
        <h1 className="font-mono text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
          Pipeline de upload e ingestao
        </h1>
        <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
          Fluxo em etapas: selecione a certificacao, confira o status do guide e depois escolha o tipo de upload.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin">
            <PixelButton variant="ghost">Voltar</PixelButton>
          </Link>
          <Link href="/admin/questions">
            <PixelButton variant="ghost">Ver banco de questoes</PixelButton>
          </Link>
          <PixelButton type="button" variant="ghost" onClick={() => void reloadAdminUploadData()}>
            Atualizar dados
          </PixelButton>
        </div>
      </PixelCard>

      <PixelCard className="space-y-4">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Etapa 1 - Certificacao alvo</p>
        <label className="block space-y-2">
          <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Selecione a certificacao</span>
          <select
            name="certificationCode"
            value={selectedCertificationCode}
            onChange={(event) => {
              setSelectedCertificationCode(event.target.value);
              resetStatus();
            }}
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
      </PixelCard>

      <PixelCard className="space-y-4">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Etapa 2 - Exam Guide</p>
        {selectedGuideStatus ? (
          <>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
              {selectedGuideStatus.code} - {selectedGuideStatus.name}:{" "}
              {selectedGuideStatus.hasExamGuide ? "guide ja enviado" : "guide ainda nao enviado"}
            </p>
            {selectedGuideStatus.latestUpload && (
              <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                Ultimo guide: {selectedGuideStatus.latestUpload.fileName} em{" "}
                {formatDate(selectedGuideStatus.latestUpload.createdAt)}
              </p>
            )}
          </>
        ) : (
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Selecione a certificacao para ver status.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <PixelButton
            type="button"
            onClick={() => {
              startAction("exam-guide");
            }}
          >
            {selectedGuideStatus?.hasExamGuide ? "Atualizar guide" : "Enviar guide"}
          </PixelButton>
        </div>
      </PixelCard>

      <PixelCard className="space-y-4">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Etapa 3 - Upload de documento</p>
        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
          Escolha como o PDF deve ser processado.
        </p>
        <div className="flex flex-wrap gap-2">
          <PixelButton type="button" variant="ghost" onClick={() => setShowFlowHelp(true)}>
            Como funciona o fluxo
          </PixelButton>
        </div>
        {!showUploadActions ? (
          <PixelButton type="button" onClick={() => setShowUploadActions(true)}>
            Escolher opcao de upload
          </PixelButton>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            <button
              type="button"
              onClick={() => startAction("simulado-completo")}
              className="border border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10 px-3 py-3 text-left"
            >
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">1 clique</p>
              <p className="text-xs">Extrair questoes reais do PDF, enriquecer com IA e salvar.</p>
            </button>
            <button
              type="button"
              onClick={() => startAction("simulado")}
              className="border border-[var(--pixel-border)] px-3 py-3 text-left"
            >
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">2 etapas</p>
              <p className="text-xs">Extrair texto e depois gerar um novo simulado com IA.</p>
            </button>
            <button
              type="button"
              onClick={() => setShowUploadActions(false)}
              className="border border-[var(--pixel-border)] px-3 py-3 text-left"
            >
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Cancelar</p>
              <p className="text-xs">Fechar opcoes de upload.</p>
            </button>
          </div>
        )}
      </PixelCard>

      <PixelCard>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Etapa 4 - Executar acao</p>
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
            Acao selecionada:{" "}
            {mode === "exam-guide"
              ? "Upload de Exam Guide"
              : mode === "simulado"
                ? "Simulado em 2 etapas"
                : "Simulado 1 clique"}
          </p>

          <label className="block space-y-2">
            <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Arquivo PDF</span>
            <input
              type="file"
              name="file"
              accept="application/pdf,.pdf"
              multiple={mode === "simulado-completo"}
              className="w-full rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
            />
            {mode === "simulado-completo" && (
              <p className="text-xs text-[var(--pixel-subtext)]">
                Voce pode selecionar varios PDFs. O processamento sera feito em fila (um por vez).
              </p>
            )}
          </label>

          {mode === "exam-guide" && (
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                Fallback manual (para PDF escaneado)
              </span>
              <textarea
                value={manualExamGuideText}
                onChange={(event) => setManualExamGuideText(event.target.value)}
                placeholder="Cole aqui o texto do exam guide caso o PDF nao tenha texto selecionavel."
                className="min-h-[180px] w-full rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-3">
            <PixelButton type="submit" disabled={loading}>
              {loading
                ? "Processando..."
                : mode === "exam-guide"
                  ? "Salvar Exam Guide"
                  : mode === "simulado-completo"
                    ? "Processar fila de simulados (1 clique)"
                    : "Extrair texto do simulado"}
            </PixelButton>

            {mode === "simulado" && simuladoResult && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--pixel-subtext)]">
                  OCR concluido. Questoes estimadas no texto: {estimatedExtractedQuestions || "nao identificadas"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <PixelButton type="button" disabled={saving} onClick={() => void handleIngest("extract-existing")}>
                    {saving ? "Salvando questoes..." : "Modo 1: Extrair e curar questoes existentes"}
                  </PixelButton>
                  <PixelButton type="button" disabled={saving} onClick={() => void handleIngest("generate-new")}>
                    {saving
                      ? "Salvando questoes..."
                      : `Modo 2: Gerar novo simulado (${Math.max(10, Math.min(80, estimatedExtractedQuestions || 20))} questoes)`}
                  </PixelButton>
                </div>
                <p className="text-xs text-[var(--pixel-subtext)]">
                  Dica: use Modo 1 para preservar as questoes do PDF. Use Modo 2 para criar versao totalmente nova.
                </p>
              </div>
            )}

            {(loading || activeJobId) && (
              <PixelButton type="button" variant="ghost" onClick={() => void handleCancelActiveProcessing()}>
                {cancelRequested ? "Cancelamento solicitado..." : "Cancelar processamento"}
              </PixelButton>
            )}
          </div>

          {mode === "exam-guide" && selectedGuideStatus?.hasExamGuide && (
            <label className="flex items-center gap-2 text-xs text-[var(--pixel-subtext)]">
              <input
                type="checkbox"
                checked={overwriteExamGuide}
                onChange={(event) => setOverwriteExamGuide(event.target.checked)}
              />
              Confirmo que desejo sobrescrever o Exam Guide atual desta certificacao.
            </label>
          )}
        </form>
      </PixelCard>

      {jobSnapshot && (
        <PixelCard className="space-y-3">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Progresso do processamento</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Etapa: {jobSnapshot.status} | {jobSnapshot.message || "Processando..."}
          </p>
          <div className="h-3 w-full overflow-hidden rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
            <div
              className="h-full bg-[var(--pixel-primary)] transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, jobSnapshot.progressPercent))}%` }}
            />
          </div>
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
            {jobSnapshot.progressPercent}% concluido
          </p>
        </PixelCard>
      )}

      {simuladoQueue.length > 0 && (
        <PixelCard className="space-y-3">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Fila de simulados</p>
          <div className="space-y-2">
            {simuladoQueue.map((item) => (
              <div key={item.id} className="rounded border border-[var(--pixel-border)] p-2 text-xs">
                <p className="font-mono uppercase text-[var(--pixel-text)]">
                  {item.fileName} | {item.status}
                </p>
                {typeof item.savedCount === "number" && (
                  <p className="text-[var(--pixel-subtext)]">
                    Geradas: {item.generatedCount ?? 0} | Salvas: {item.savedCount} | Rejeitadas:{" "}
                    {item.rejectedCount ?? 0}
                  </p>
                )}
                {item.error && <p className="text-[var(--pixel-danger)]">{item.error}</p>}
              </div>
            ))}
          </div>
        </PixelCard>
      )}

      {error && (
        <PixelCard className="border-[var(--pixel-danger)] bg-[var(--pixel-danger)]/10">
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{error}</p>
        </PixelCard>
      )}

      {warning && (
        <PixelCard className="border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10">
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{warning}</p>
        </PixelCard>
      )}

      {examGuideResult && (
        <PixelCard className="space-y-3 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Exam Guide atualizado</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            {examGuideResult.message} | Certificacao: {examGuideResult.certification.code} | Caracteres:{" "}
            {examGuideResult.characters}
          </p>
          <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3 text-xs leading-5 text-[var(--pixel-text)]">
            {examGuideResult.preview}
          </pre>
        </PixelCard>
      )}

      {ingestResult && (
        <PixelCard className="space-y-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Ingestao concluida</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Certificacao: {ingestResult.certificationCode} | Geradas: {ingestResult.generatedCount} | Salvas:{" "}
            {ingestResult.savedCount} | Rejeitadas: {ingestResult.rejectedCount ?? 0}
          </p>
          {ingestResult.rejectionReasons && (
            <p className="font-[var(--font-body)] text-xs leading-5 text-[var(--pixel-subtext)]">
              Motivos de rejeicao:{" "}
              {Object.entries(ingestResult.rejectionReasons)
                .filter(([, total]) => total > 0)
                .map(([reason, total]) => `${reason} (${total})`)
                .join(" | ") || "nenhum"}
            </p>
          )}
        </PixelCard>
      )}

      {uploadDashboard && (
        <PixelCard className="space-y-4">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
            Arquivos enviados e jobs recentes
          </p>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Arquivos</p>
            {uploadDashboard.files.length === 0 ? (
              <p className="text-sm text-[var(--pixel-subtext)]">Nenhum arquivo registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {uploadDashboard.files.map((fileItem) => (
                  <div key={fileItem.id} className="rounded border border-[var(--pixel-border)] p-2 text-xs">
                    <p className="font-mono uppercase text-[var(--pixel-text)]">
                      {fileItem.uploadType} | {fileItem.fileName}
                    </p>
                    <p className="text-[var(--pixel-subtext)]">
                      {fileItem.certificationPreset?.code ?? "SEM-CERT"} | {formatBytes(fileItem.fileSizeBytes)} |{" "}
                      {formatDate(fileItem.createdAt)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] uppercase text-[var(--pixel-subtext)]">
                        Questoes geradas: {fileItem._count.generatedQuestions}
                      </span>
                      {fileItem._count.generatedQuestions > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuditFileId(fileItem.id);
                            setAuditPage(1);
                          }}
                          className="border border-[var(--pixel-border)] px-2 py-1 text-[10px] uppercase"
                        >
                          Ver questoes
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">Jobs</p>
            {uploadDashboard.recentJobs.length === 0 ? (
              <p className="text-sm text-[var(--pixel-subtext)]">Nenhum job registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {uploadDashboard.recentJobs.map((jobItem) => (
                  <div key={jobItem.id} className="rounded border border-[var(--pixel-border)] p-2 text-xs">
                    <p className="font-mono uppercase text-[var(--pixel-text)]">
                      {jobItem.uploadType} | {jobItem.status} | {jobItem.progressPercent}%
                    </p>
                    <p className="text-[var(--pixel-subtext)]">
                      {jobItem.certificationPreset?.code ?? "SEM-CERT"} | {formatDate(jobItem.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PixelCard>
      )}

      {auditFileId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-4xl space-y-4 rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Auditoria</p>
                <p className="text-sm text-[var(--pixel-text)]">
                  {auditPayload?.uploadedFile.fileName ?? "Carregando documento..."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAudit}
                className="border border-[var(--pixel-border)] px-2 py-1 text-xs uppercase"
              >
                Fechar
              </button>
            </div>

            {auditLoading && <p className="text-sm text-[var(--pixel-subtext)]">Carregando questoes do documento...</p>}
            {auditError && <p className="text-sm text-[var(--pixel-danger)]">{auditError}</p>}

            {!auditLoading && auditPayload && (
              <>
                <div className="max-h-[420px] overflow-auto rounded border border-[var(--pixel-border)]">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="border-b border-[var(--pixel-border)] bg-black/10 uppercase text-[var(--pixel-subtext)]">
                      <tr>
                        <th className="px-2 py-2">Enunciado</th>
                        <th className="px-2 py-2">Topico</th>
                        <th className="px-2 py-2">Dificuldade</th>
                        <th className="px-2 py-2">Tipo</th>
                        <th className="px-2 py-2">Uso</th>
                        <th className="px-2 py-2">Gabarito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditPayload.items.length === 0 && (
                        <tr>
                          <td className="px-2 py-3" colSpan={6}>
                            Nenhuma questao vinculada a este documento.
                          </td>
                        </tr>
                      )}
                      {auditPayload.items.map((question) => (
                        <tr key={question.id} className="border-b border-[var(--pixel-border)]">
                          <td className="px-2 py-2">{question.statement.slice(0, 130)}...</td>
                          <td className="px-2 py-2">{question.topic}</td>
                          <td className="px-2 py-2 uppercase">{question.difficulty}</td>
                          <td className="px-2 py-2 uppercase">{question.questionType}</td>
                          <td className="px-2 py-2 uppercase">{question.usage}</td>
                          <td className="px-2 py-2 uppercase">
                            {(question.correctOptions ?? [question.correctOption]).join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span>
                    Pagina {auditPayload.page} de {auditPayload.totalPages} | Total: {auditPayload.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={auditPayload.page <= 1}
                      onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                      className="border border-[var(--pixel-border)] px-2 py-1 uppercase disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={auditPayload.page >= auditPayload.totalPages}
                      onClick={() => setAuditPage((prev) => Math.min(auditPayload.totalPages, prev + 1))}
                      className="border border-[var(--pixel-border)] px-2 py-1 uppercase disabled:opacity-40"
                    >
                      Proxima
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showFlowHelp && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-3xl space-y-4 rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Guia rapido</p>
                <p className="text-sm text-[var(--pixel-text)]">
                  Como extrair mais questoes do PDF sem perder qualidade
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFlowHelp(false)}
                className="border border-[var(--pixel-border)] px-2 py-1 text-xs uppercase"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-2 text-sm text-[var(--pixel-text)]">
              <p>1) Selecione a certificacao correta antes do upload para melhorar classificacao de servico e nivel.</p>
              <p>2) Execute OCR primeiro no modo 2 etapas para validar o texto extraido.</p>
              <p>
                3) Escolha Modo 1 (Extrair e curar) quando quiser manter as questoes do PDF original. Esse modo busca
                cobrir todos os blocos de questao identificados.
              </p>
              <p>
                4) Escolha Modo 2 (Gerar novo) quando quiser um simulado novo baseado no contexto extraido. A quantidade
                alvo usa a estimativa de questoes detectadas.
              </p>
              <p>
                5) Se o OCR vier com muito ruido, recorte o PDF por secoes ou tente novamente com arquivo mais limpo.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
