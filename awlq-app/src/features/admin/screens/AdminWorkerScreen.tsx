"use client";

import { useEffect, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";

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
  const [activeTab, setActiveTab] = useState<"generation" | "worker">("generation");

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

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worker");
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

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
      setTimeout(() => fetchData(), 3000);
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
          <PixelButton onClick={fetchData} variant="ghost">
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
      <div className="flex gap-1 border-b-2 border-[var(--pixel-border)]">
        {(["generation", "worker"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-mono text-[10px] uppercase transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                : "text-[var(--pixel-subtext)] hover:text-[var(--pixel-text)]"
            }`}
          >
            {tab === "generation" ? "Geracao" : "Worker"}
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
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Historico de Jobs (ultimos 20)</p>
            {data.triggerHistory.length === 0 ? (
              <p className="text-xs text-[var(--pixel-subtext)]">Nenhum job disparado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--pixel-border)] text-left">
                      <th className="pb-2 pr-4 font-mono text-[9px] uppercase text-[var(--pixel-subtext)]">Acao</th>
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
          </PixelCard>
        </div>
      )}
    </main>
  );
}
