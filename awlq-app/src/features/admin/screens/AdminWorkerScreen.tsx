"use client";

import { useEffect, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { AdminQuestionDetailModal } from "@/features/admin/components/AdminQuestionDetailModal";
import { ScheduledJobEditModal } from "@/features/admin/components/ScheduledJobEditModal";
import { parseCronToHuman } from "@/lib/cron-utils";

type IngestionSource = {
  id: string;
  displayName: string;
  url: string;
  status: string;
  lastFetchedAt: string | null;
  parsedDomainCount: number;
  generatedQuestionCount: number;
  errorMessage: string | null;
  active: boolean;
  certificationPreset: { code: string; name: string } | null;
};

type BlueprintStat = {
  certificationPresetId: string;
  cert: { code: string; name: string } | null;
  domainCount: number;
  totalWeight: number;
};

type WeakAreaReport = {
  id: string;
  analyzedAt: string;
  windowDays: number;
  sessionsAnalyzed: number;
  generationQueued: boolean;
  weakAreas: unknown[];
  certificationPreset: { code: string; name: string };
};

type PerformanceStats = { flagged: number; improved: number; retired: number };
type Certification = { id: string; code: string; name: string };

type TriggerHistoryItem = {
  id: string;
  action: string;
  source: string;
  certificationPresetId: string | null;
  processed: boolean;
  processedAt: string | null;
  createdAt: string;
};

type QueueStat = { total: number; pending: number; processed: number };

type WorkerOverview = {
  ingestionSources: IngestionSource[];
  blueprintStats: BlueprintStat[];
  weakAreaReports: WeakAreaReport[];
  performance: PerformanceStats;
  certifications: Certification[];
  triggerHistory: TriggerHistoryItem[];
  triggerHistoryPage: number;
  triggerHistoryPageSize: number;
  triggerHistoryTotal: number;
  triggerHistoryTotalPages: number;
  queueStats: Record<string, QueueStat>;
};

function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">{title}</p>
      <p className="mt-2 font-mono text-lg uppercase text-[var(--pixel-primary)]">{String(value)}</p>
      {sub && <p className="mt-1 text-xs text-[var(--pixel-subtext)]">{sub}</p>}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "text-green-400",
  FETCHING: "text-yellow-400",
  FAILED: "text-red-400",
  PENDING: "text-[var(--pixel-subtext)]",
  FETCHED: "text-blue-400",
};

const ACTION_LABEL: Record<string, string> = {
  generate: "Geracao",
  "analyze-feedback": "Analise Feedback",
  "fetch-sources": "Fetch Sources",
  "quality-scan": "Quality Scan",
  "email-send": "Envio Email",
};

export function AdminWorkerScreen() {
  const [data, setData] = useState<WorkerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"generation" | "worker" | "questions" | "scheduled" | "manual">("generation");
  const [historyPage, setHistoryPage] = useState(1);

  // Questions audit tab state
  type GeneratedQuestion = {
    id: string;
    statement: string;
    topic: string | null;
    difficulty: string;
    questionType: string;
    createdAt: string;
    certificationPreset: { code: string; name: string } | null;
    awsServices: string[];
  };
  type QuestionsPage = {
    items: GeneratedQuestion[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  const [questionsData, setQuestionsData] = useState<QuestionsPage | null>(null);
  const [questionsPage, setQuestionsPage] = useState(1);
  const [questionsCertId, setQuestionsCertId] = useState("");
  const [questionsDateFrom, setQuestionsDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [questionsDateTo, setQuestionsDateTo] = useState("");
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [selectedWorkerQuestionId, setSelectedWorkerQuestionId] = useState<string | null>(null);

  // Scheduled jobs tab state
  type ScheduledJob = {
    id: string;
    jobId: string;
    name: string;
    description: string | null;
    queue: string;
    cronPattern: string;
    active: boolean;
    updatedAt: string;
  };
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [newJob, setNewJob] = useState({ jobId: "", name: "", description: "", queue: "question-generation", cronPattern: "" });

  // Generation tab state
  const [selectedCert, setSelectedCert] = useState("");
  const [selectedAction, setSelectedAction] = useState("generate");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSourceCert, setNewSourceCert] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [addSourceMsg, setAddSourceMsg] = useState<string | null>(null);

  async function fetchData(page = historyPage) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/worker?historyPage=${page}&historyPageSize=20`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(historyPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage]);

  async function fetchQuestions(
    page = questionsPage,
    certId = questionsCertId,
    dateFrom = questionsDateFrom,
    dateTo = questionsDateTo,
  ) {
    setQuestionsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (certId) params.set("certificationId", certId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/admin/worker/questions?${params}`);
      if (!res.ok) throw new Error(await res.text());
      setQuestionsData(await res.json());
    } catch {
      // keep previous data on error
    } finally {
      setQuestionsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "questions") {
      fetchQuestions(questionsPage, questionsCertId, questionsDateFrom, questionsDateTo);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, questionsPage, questionsCertId, questionsDateFrom, questionsDateTo]);

  async function fetchScheduledJobs() {
    setScheduledLoading(true);
    try {
      const res = await fetch("/api/admin/scheduled-jobs");
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { jobs: ScheduledJob[] };
      setScheduledJobs(json.jobs);
    } catch {
      // keep previous
    } finally {
      setScheduledLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "scheduled") {
      fetchScheduledJobs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleToggleJob(job: ScheduledJob) {
    await fetch(`/api/admin/scheduled-jobs/${job.jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !job.active }),
    });
    await fetchScheduledJobs();
  }

  async function handleCreateJob() {
    setEditMsg(null);
    const res = await fetch("/api/admin/scheduled-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newJob),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setEditMsg(json.error ?? "Erro ao criar job");
      return;
    }
    setShowNewJobForm(false);
    setNewJob({ jobId: "", name: "", description: "", queue: "question-generation", cronPattern: "" });
    await fetchScheduledJobs();
  }

  async function handleAddSource() {
    setAddingSource(true);
    setAddSourceMsg(null);
    try {
      const res = await fetch("/api/admin/ingestion-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newDisplayName,
          url: newUrl,
          certificationPresetId: newSourceCert || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao adicionar fonte");
      setAddSourceMsg(`Fonte "${json.source.displayName}" criada. Dispare "fetch-sources" para processar.`);
      setNewDisplayName("");
      setNewUrl("");
      setNewSourceCert("");
      await fetchData();
    } catch (err) {
      setAddSourceMsg(err instanceof Error ? err.message : "Erro ao adicionar fonte");
    } finally {
      setAddingSource(false);
    }
  }

  async function handleToggleSource(id: string, active: boolean) {
    await fetch("/api/admin/ingestion-sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    await fetchData();
  }

  async function handleTrigger() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await fetch("/api/admin/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: selectedAction, certificationPresetId: selectedCert || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTriggerMsg(`Trigger "${selectedAction}" enfileirado. O worker processara em ate 30s.`);
      setTimeout(() => fetchData(historyPage), 3000);
    } catch (err) {
      setTriggerMsg(err instanceof Error ? err.message : "Erro ao disparar trigger");
    } finally {
      setTriggering(false);
    }
  }

  if (error) {
    return (
      <PixelCard className="border-[var(--pixel-danger)]">
        <p className="font-mono text-xs uppercase text-[var(--pixel-danger)]">Erro</p>
        <p className="mt-2 text-sm text-[var(--pixel-text)]">{error}</p>
      </PixelCard>
    );
  }

  if (!data) return null;

  const weakAreaCount = data.weakAreaReports.reduce((s, r) => s + r.weakAreas.length, 0);
  const certMap = new Map(data.certifications.map((c) => [c.id, c]));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      {loading && (
        <PixelCard>
          <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando dados do worker...</p>
        </PixelCard>
      )}

      <PixelCard className="space-y-3">
        <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Admin</p>
        <h1 className="font-mono text-sm uppercase leading-6 text-[var(--pixel-primary)]">
          Worker / Sistema de Geracao
        </h1>
        <div className="flex items-center gap-3">
          <PixelButton onClick={() => fetchData(historyPage)} variant="ghost">
            Atualizar
          </PixelButton>
        </div>
      </PixelCard>

      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Fontes Ativas" value={data.ingestionSources.filter((s) => s.active).length} />
        <StatCard title="Dominios Blueprints" value={data.blueprintStats.reduce((s, r) => s + r.domainCount, 0)} />
        <StatCard
          title="Questoes Flagadas"
          value={data.performance.flagged}
          sub={`${data.performance.improved} melhoradas · ${data.performance.retired} aposentadas`}
        />
        <StatCard title="Areas Fracas" value={weakAreaCount} sub="ultimos 20 relatorios" />
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b-2 border-[var(--pixel-border)]">
        {(["generation", "worker", "questions", "scheduled", "manual"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-mono text-[10px] uppercase transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                : "text-[var(--pixel-subtext)] hover:text-[var(--pixel-text)]"
            }`}
          >
            {tab === "generation"
              ? "Geracao"
              : tab === "worker"
              ? "Worker"
              : tab === "questions"
              ? "Questoes Geradas"
              : tab === "scheduled"
              ? "Jobs Agendados"
              : "Manual"}
          </button>
        ))}
      </div>

      {/* Tab: Geracao */}
      {activeTab === "generation" && (
        <div className="space-y-6">
          {/* Ingestion Sources */}
          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Fontes de Ingestao</p>
            {data.ingestionSources.length === 0 ? (
              <p className="text-xs text-[var(--pixel-subtext)]">Nenhuma fonte cadastrada ainda.</p>
            ) : (
              <div className="divide-y divide-[var(--pixel-border)]">
                {data.ingestionSources.map((src) => (
                  <div key={src.id} className="py-2 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[var(--pixel-text)]">{src.displayName}</p>
                        <p className="truncate text-[var(--pixel-subtext)]">{src.certificationPreset?.code ?? "—"}</p>
                        <p className="truncate text-[var(--pixel-subtext)] opacity-60">{src.url}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className={`font-mono uppercase ${STATUS_COLOR[src.status] ?? ""}`}>{src.status}</p>
                        <p className="text-[var(--pixel-subtext)]">
                          {src.parsedDomainCount} dom · {src.generatedQuestionCount} q
                        </p>
                        <button
                          onClick={() => handleToggleSource(src.id, !src.active)}
                          className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase ${
                            src.active
                              ? "bg-green-900 text-green-300 hover:bg-red-900 hover:text-red-300"
                              : "bg-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:bg-green-900 hover:text-green-300"
                          }`}
                        >
                          {src.active ? "Ativo" : "Inativo"}
                        </button>
                      </div>
                    </div>
                    {src.errorMessage && <p className="mt-1 text-red-400">{src.errorMessage}</p>}
                    {src.lastFetchedAt && (
                      <p className="text-[var(--pixel-subtext)]">
                        Ultimo fetch: {new Date(src.lastFetchedAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[var(--pixel-border)] pt-3 space-y-2">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Adicionar Fonte</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Nome da fonte"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="flex-1 min-w-40 rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)] placeholder:text-[var(--pixel-subtext)]"
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="flex-[2] min-w-52 rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)] placeholder:text-[var(--pixel-subtext)]"
                />
                <select
                  value={newSourceCert}
                  onChange={(e) => setNewSourceCert(e.target.value)}
                  className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)]"
                >
                  <option value="">Cert (opcional)</option>
                  {data.certifications.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <PixelButton
                  onClick={handleAddSource}
                  disabled={addingSource || !newDisplayName.trim() || !newUrl.trim()}
                >
                  {addingSource ? "Adicionando..." : "Adicionar"}
                </PixelButton>
              </div>
              {addSourceMsg && <p className="text-xs text-[var(--pixel-subtext)]">{addSourceMsg}</p>}
            </div>
          </PixelCard>

          {/* Blueprint Domains */}
          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Blueprints por Certificacao</p>
            {data.blueprintStats.length === 0 ? (
              <p className="text-xs text-[var(--pixel-subtext)]">
                Nenhum blueprint extraido ainda. Faca fetch de uma fonte com exam guide.
              </p>
            ) : (
              <div className="divide-y divide-[var(--pixel-border)]">
                {data.blueprintStats.map((row) => (
                  <div key={row.certificationPresetId} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <p className="font-mono text-[var(--pixel-text)]">{row.cert?.code ?? "?"}</p>
                      <p className="text-[var(--pixel-subtext)]">{row.cert?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[var(--pixel-primary)]">{row.domainCount} dominios</p>
                      <p className="text-[var(--pixel-subtext)]">{row.totalWeight.toFixed(0)}% total</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PixelCard>

          {/* Weak Area Reports */}
          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Relatorios de Areas Fracas</p>
            {data.weakAreaReports.length === 0 ? (
              <p className="text-xs text-[var(--pixel-subtext)]">
                Nenhum relatorio ainda. Rode {"analyze-feedback"} para gerar.
              </p>
            ) : (
              <div className="divide-y divide-[var(--pixel-border)]">
                {data.weakAreaReports.map((report) => (
                  <div key={report.id} className="py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[var(--pixel-text)]">{report.certificationPreset.code}</p>
                        <p className="text-[var(--pixel-subtext)]">
                          {new Date(report.analyzedAt).toLocaleString("pt-BR")} · {report.sessionsAnalyzed} sessoes
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-mono uppercase ${report.generationQueued ? "text-green-400" : "text-yellow-400"}`}
                        >
                          {report.weakAreas.length} areas fracas
                        </p>
                        <p className="text-[var(--pixel-subtext)]">
                          {report.generationQueued ? "Geracao enfileirada" : "Pendente"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PixelCard>

          {/* Manual Trigger */}
          <PixelCard className="space-y-4">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Disparar Manualmente</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-[var(--pixel-subtext)]">Acao</p>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)]"
                >
                  <option value="generate">Gerar questoes</option>
                  <option value="analyze-feedback">Analisar feedback</option>
                  <option value="fetch-sources">Fetch de fontes</option>
                  <option value="quality-scan">Quality scan</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-[var(--pixel-subtext)]">Certificacao (opcional)</p>
                <select
                  value={selectedCert}
                  onChange={(e) => setSelectedCert(e.target.value)}
                  className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)]"
                >
                  <option value="">Todas</option>
                  {data.certifications.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <PixelButton onClick={handleTrigger} disabled={triggering}>
                {triggering ? "Enfileirando..." : "Disparar agora"}
              </PixelButton>
            </div>
            {triggerMsg && <p className="text-xs text-[var(--pixel-subtext)]">{triggerMsg}</p>}
          </PixelCard>
        </div>
      )}

      {/* Tab: Worker */}
      {activeTab === "worker" && (
        <div className="space-y-6">
          {/* Queue Stats */}
          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Filas Ativas</p>
            {Object.keys(data.queueStats).length === 0 ? (
              <p className="text-xs text-[var(--pixel-subtext)]">Nenhum job registrado ainda.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(data.queueStats).map(([action, stat]) => (
                  <div key={action} className="rounded border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
                    <p className="font-mono text-[10px] uppercase text-[var(--pixel-primary)]">
                      {ACTION_LABEL[action] ?? action}
                    </p>
                    <div className="mt-2 flex gap-3 text-xs text-[var(--pixel-subtext)]">
                      <span>Total: <span className="text-[var(--pixel-text)]">{stat.total}</span></span>
                      <span>Pendente: <span className="text-yellow-400">{stat.pending}</span></span>
                      <span>Processado: <span className="text-green-400">{stat.processed}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PixelCard>

          {/* Trigger History */}
          <PixelCard className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                Historico de Jobs · {data.triggerHistoryTotal} total
              </p>
              <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                Pag. {data.triggerHistoryPage} / {data.triggerHistoryTotalPages}
              </p>
            </div>
            {data.triggerHistory.length === 0 ? (
              <p className="text-xs text-[var(--pixel-subtext)]">Nenhum job disparado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--pixel-border)] text-left">
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Acao</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Origem</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Cert</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Criado</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--pixel-border)]">
                    {data.triggerHistory.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 pr-4 font-mono text-[var(--pixel-text)]">
                          {ACTION_LABEL[item.action] ?? item.action}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                              item.source === "cron"
                                ? "bg-blue-900/40 text-blue-400"
                                : item.source === "weak_area"
                                ? "bg-purple-900/40 text-purple-400"
                                : "bg-[var(--pixel-border)] text-[var(--pixel-subtext)]"
                            }`}
                          >
                            {item.source === "cron" ? "Cron" : item.source === "weak_area" ? "Area Fraca" : "Manual"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-[var(--pixel-subtext)]">
                          {item.certificationPresetId
                            ? (certMap.get(item.certificationPresetId)?.code ?? item.certificationPresetId.slice(0, 8))
                            : "Todas"}
                        </td>
                        <td className="py-2 pr-4 text-[var(--pixel-subtext)]">
                          {new Date(item.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                              item.processed
                                ? "bg-green-900/40 text-green-400"
                                : "bg-yellow-900/40 text-yellow-400"
                            }`}
                          >
                            {item.processed ? "Processado" : "Pendente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.triggerHistoryTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--pixel-border)] pt-3">
                <PixelButton
                  variant="ghost"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage <= 1}
                >
                  Anterior
                </PixelButton>
                <span className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                  {historyPage} / {data.triggerHistoryTotalPages}
                </span>
                <PixelButton
                  variant="ghost"
                  onClick={() => setHistoryPage((p) => Math.min(data.triggerHistoryTotalPages, p + 1))}
                  disabled={historyPage >= data.triggerHistoryTotalPages}
                >
                  Proxima
                </PixelButton>
              </div>
            )}
          </PixelCard>
        </div>
      )}

      {/* Tab: Questoes Geradas */}
      {activeTab === "questions" && (
        <div className="space-y-6">
          <PixelCard className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
              Filtros
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-[var(--pixel-subtext)]">Certificacao</p>
                <select
                  value={questionsCertId}
                  onChange={(e) => {
                    setQuestionsCertId(e.target.value);
                    setQuestionsPage(1);
                  }}
                  className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)]"
                >
                  <option value="">Todas</option>
                  {data.certifications.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-[var(--pixel-subtext)]">De</p>
                <input
                  type="date"
                  value={questionsDateFrom}
                  onChange={(e) => { setQuestionsDateFrom(e.target.value); setQuestionsPage(1); }}
                  className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase text-[var(--pixel-subtext)]">Ate</p>
                <input
                  type="date"
                  value={questionsDateTo}
                  onChange={(e) => { setQuestionsDateTo(e.target.value); setQuestionsPage(1); }}
                  className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)]"
                />
              </div>
              <PixelButton
                onClick={() => fetchQuestions(questionsPage, questionsCertId, questionsDateFrom, questionsDateTo)}
                disabled={questionsLoading}
              >
                {questionsLoading ? "Carregando..." : "Atualizar"}
              </PixelButton>
            </div>
          </PixelCard>

          <PixelCard className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                Questoes geradas pelo worker
                {questionsData ? ` · ${questionsData.total} total` : ""}
              </p>
              {questionsData && questionsData.totalPages > 1 && (
                <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                  Pag. {questionsData.page} / {questionsData.totalPages}
                </p>
              )}
            </div>

            {!questionsData || questionsData.items.length === 0 ? (
              <p className="text-xs text-[var(--pixel-subtext)]">
                {questionsLoading ? "Carregando..." : "Nenhuma questao gerada pelo worker ainda."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--pixel-border)] text-left">
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Criado</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Cert</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Topico</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Dific</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Tipo</th>
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Servicos AWS</th>
                      <th className="pb-2 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Enunciado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--pixel-border)]">
                    {questionsData.items.map((q) => (
                      <tr
                        key={q.id}
                        className="cursor-pointer hover:bg-white/5"
                        onClick={() => setSelectedWorkerQuestionId(q.id)}
                      >
                        <td className="py-2 pr-4 text-[var(--pixel-subtext)] whitespace-nowrap">
                          {new Date(q.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2 pr-4 font-mono text-[var(--pixel-primary)]">
                          {q.certificationPreset?.code ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-[var(--pixel-subtext)] max-w-[120px] truncate">
                          {q.topic ?? "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                              q.difficulty === "hard"
                                ? "bg-red-900/40 text-red-400"
                                : q.difficulty === "medium"
                                ? "bg-yellow-900/40 text-yellow-400"
                                : "bg-green-900/40 text-green-400"
                            }`}
                          >
                            {q.difficulty === "hard" ? "Dif" : q.difficulty === "medium" ? "Med" : "Fac"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-[var(--pixel-subtext)]">
                          {q.questionType === "multi" ? "Multi" : "Unica"}
                        </td>
                        <td className="py-2 pr-4 text-[var(--pixel-subtext)] max-w-[140px] truncate">
                          {q.awsServices.length > 0 ? q.awsServices.join(", ") : "—"}
                        </td>
                        <td className="py-2 text-[var(--pixel-text)] max-w-[260px]">
                          <p className="line-clamp-2">{q.statement}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {questionsData && questionsData.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--pixel-border)] pt-3">
                <PixelButton
                  variant="ghost"
                  onClick={() => setQuestionsPage((p) => Math.max(1, p - 1))}
                  disabled={questionsPage <= 1 || questionsLoading}
                >
                  Anterior
                </PixelButton>
                <span className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                  {questionsPage} / {questionsData.totalPages}
                </span>
                <PixelButton
                  variant="ghost"
                  onClick={() => setQuestionsPage((p) => Math.min(questionsData.totalPages, p + 1))}
                  disabled={questionsPage >= questionsData.totalPages || questionsLoading}
                >
                  Proxima
                </PixelButton>
              </div>
            )}
          </PixelCard>
        </div>
      )}

      {/* Tab: Jobs Agendados */}
      {activeTab === "scheduled" && (
        <div className="space-y-6">
          <PixelCard className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Jobs Agendados (BullMQ)</p>
              <div className="flex gap-2">
                <PixelButton variant="ghost" onClick={fetchScheduledJobs} disabled={scheduledLoading}>
                  Atualizar
                </PixelButton>
                <PixelButton onClick={() => { setShowNewJobForm((v) => !v); setEditMsg(null); }}>
                  {showNewJobForm ? "Cancelar" : "Novo Job"}
                </PixelButton>
              </div>
            </div>
            <p className="text-[10px] text-[var(--pixel-subtext)]">
              Alteracoes sao aplicadas em ate 60s pelo worker automaticamente.
            </p>

            {showNewJobForm && (
              <div className="space-y-2 rounded border border-[var(--pixel-border)] p-3">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Criar novo job</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="jobId (ex: cron-meu-job)"
                    value={newJob.jobId}
                    onChange={(e) => setNewJob((j) => ({ ...j, jobId: e.target.value }))}
                    className="flex-1 min-w-40 rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)] placeholder:text-[var(--pixel-subtext)]"
                  />
                  <input
                    placeholder="Nome"
                    value={newJob.name}
                    onChange={(e) => setNewJob((j) => ({ ...j, name: e.target.value }))}
                    className="flex-1 min-w-40 rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)] placeholder:text-[var(--pixel-subtext)]"
                  />
                  <select
                    value={newJob.queue}
                    onChange={(e) => setNewJob((j) => ({ ...j, queue: e.target.value }))}
                    className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)]"
                  >
                    <option value="question-generation">question-generation</option>
                    <option value="source-fetch">source-fetch</option>
                    <option value="feedback-analysis">feedback-analysis</option>
                    <option value="performance-compute">performance-compute</option>
                    <option value="email-send">email-send</option>
                  </select>
                  <input
                    placeholder="Cron (ex: 0 8 * * *)"
                    value={newJob.cronPattern}
                    onChange={(e) => setNewJob((j) => ({ ...j, cronPattern: e.target.value }))}
                    className="min-w-36 rounded border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-2 py-1 text-xs text-[var(--pixel-text)] placeholder:text-[var(--pixel-subtext)]"
                  />
                  <PixelButton
                    onClick={handleCreateJob}
                    disabled={!newJob.jobId.trim() || !newJob.name.trim() || !newJob.cronPattern.trim()}
                  >
                    Criar
                  </PixelButton>
                </div>
                {editMsg && <p className="text-xs text-red-400">{editMsg}</p>}
              </div>
            )}

            {scheduledJobs.length === 0 ? (
              <p className="text-xs text-[var(--pixel-subtext)]">
                {scheduledLoading ? "Carregando..." : "Nenhum job agendado. Inicie o worker para semear os defaults."}
              </p>
            ) : (
              <div className="divide-y divide-[var(--pixel-border)]">
                {scheduledJobs.map((job) => (
                  <div key={job.id} className="py-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[var(--pixel-text)]">{job.name}</p>
                        {job.description && <p className="text-[var(--pixel-subtext)]">{job.description}</p>}
                        <p className="font-mono text-[var(--pixel-subtext)]">
                          <span className="text-blue-400">{job.queue}</span>
                          {" · "}
                          <span className="text-yellow-400">{parseCronToHuman(job.cronPattern)}</span>
                          <span className="ml-1 text-[#475569]">({job.cronPattern})</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setEditingJob(job)}
                          className="rounded border border-[var(--pixel-border)] px-2 py-0.5 font-mono text-[9px] uppercase text-[var(--pixel-subtext)] hover:text-[var(--pixel-text)]"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => void handleToggleJob(job)}
                          className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase ${
                            job.active
                              ? "bg-green-900/60 text-green-300 hover:bg-red-900/60 hover:text-red-300"
                              : "bg-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:bg-green-900/60 hover:text-green-300"
                          }`}
                        >
                          {job.active ? "Ativo" : "Inativo"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PixelCard>
        </div>
      )}

      {activeTab === "manual" && (
        <div className="space-y-4">
          <PixelCard className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Referencia dos Workers e Jobs</p>
            <p className="text-xs text-[var(--pixel-subtext)]">
              Descricao de cada worker/job disponivel no sistema, o que faz, quando roda e quais dados processa.
            </p>
          </PixelCard>

          {[
            {
              id: "question-generation",
              title: "question-generation",
              what: "Gera novas questoes de simulado e KC para uma certificacao especifica, usando o blueprint de dominios como guia de peso por topico.",
              when: "Acionado manualmente via painel (aba Geracao) ou via job agendado.",
              inputs: "CertificationPresetId, IngestionSource (URL de blueprint), topico alvo.",
              outputs: "Novas StudyQuestion gravadas no banco, vinculadas a certificacao e servico AWS.",
            },
            {
              id: "source-fetch",
              title: "source-fetch",
              what: "Busca fontes externas (URLs de blueprints de exame) e parseia os dominios e pesos do ExamBlueprint.",
              when: "Acionado manualmente ou por job agendado apos cadastro de nova IngestionSource.",
              inputs: "IngestionSource.url (PDF ou pagina web com blueprint).",
              outputs: "ExamBlueprintDomain atualizado, contagem de dominios e pesos por certificacao.",
            },
            {
              id: "feedback-analysis",
              title: "feedback-analysis",
              what: "Analisa sessoes de estudo dos usuarios nos ultimos N dias e identifica areas com maior taxa de erro (WeakAreaReport).",
              when: "Rodado periodicamente (job agendado) ou manualmente. Default: diario.",
              inputs: "StudySessionHistory dos ultimos windowDays dias por certificacao.",
              outputs: "WeakAreaReport salvo por certificacao, com lista de areas fracas e metrica de erro por topico.",
            },
            {
              id: "performance-compute",
              title: "performance-compute",
              what: "Calcula metricas de desempenho por questao (taxa de acerto, taxa de erro, numero de tentativas) e atualiza QuestionPerformance.",
              when: "Rodado apos cada lote de sessoes ou agendado periodicamente.",
              inputs: "StudySessionHistory.answersSnapshot de todas as sessoes.",
              outputs: "QuestionPerformance atualizado por questionId, com flagged/improved/retired conforme threshold.",
            },
            {
              id: "email-send",
              title: "email-send",
              what: "Processa a fila de emails pendentes e envia mensagens usando o template configurado (aprovacao, rejeicao, etc.).",
              when: "Automaticamente quando um email e enfileirado (aprovacao/rejeicao de usuario, convite de engajamento).",
              inputs: "Fila de emails no banco com template e destinatario.",
              outputs: "Email enviado via provedor configurado; status atualizado para sent/failed.",
            },
          ].map((job) => (
            <PixelCard key={job.id} className="space-y-2">
              <p className="font-mono text-xs uppercase text-[var(--pixel-primary)]">{job.title}</p>
              <div className="grid gap-2 text-xs md:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">O que faz</p>
                  <p className="mt-0.5 text-[var(--pixel-text)]">{job.what}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Quando roda</p>
                  <p className="mt-0.5 text-[var(--pixel-text)]">{job.when}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Inputs</p>
                  <p className="mt-0.5 text-[var(--pixel-subtext)]">{job.inputs}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Outputs</p>
                  <p className="mt-0.5 text-[var(--pixel-subtext)]">{job.outputs}</p>
                </div>
              </div>
            </PixelCard>
          ))}
        </div>
      )}

      <ScheduledJobEditModal
        job={editingJob}
        onClose={() => setEditingJob(null)}
        onSaved={() => { setEditingJob(null); void fetchScheduledJobs(); }}
      />

      <AdminQuestionDetailModal
        questionId={selectedWorkerQuestionId}
        onClose={() => setSelectedWorkerQuestionId(null)}
        onDeleted={() => { setSelectedWorkerQuestionId(null); void fetchQuestions(questionsPage, questionsCertId); }}
      />
    </main>
  );
}
