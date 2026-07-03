"use client";

import { useEffect, useState } from "react";

type AiContext =
  | "QUESTION_EXPLAIN"
  | "SIMULADO_MESSAGE"
  | "LAB_GENERATION"
  | "TRAIL_QUESTION_GENERATION"
  | "WORKER_KC_QUESTION"
  | "WORKER_QUESTION_GENERATION"
  | "WORKER_QUALITY_REVIEW"
  | "WORKER_BLUEPRINT_PARSER"
  | "WORKER_EXAM_GUIDE"
  | "WORKER_EMAIL";

const MODULE_META: Record<AiContext, { label: string; desc: string; group: "app" | "worker" }> = {
  QUESTION_EXPLAIN:           { label: "Explicacao de Questoes",      desc: "Explicacoes e feedback em questoes (estudo, trilhas, mentor)",    group: "app" },
  SIMULADO_MESSAGE:           { label: "Mensagem do Simulado",         desc: "Texto motivacional e mensagens ao finalizar simulados",           group: "app" },
  LAB_GENERATION:             { label: "Geracao de Labs",              desc: "Labs praticos e roteiros da Jornada",                             group: "app" },
  TRAIL_QUESTION_GENERATION:  { label: "Questoes de Trilhas",          desc: "Geracao de questoes para as trilhas KC",                          group: "app" },
  WORKER_KC_QUESTION:         { label: "KC: Geracao de Questoes",      desc: "Geracao de questoes KC por step (worker assíncrono)",            group: "worker" },
  WORKER_QUESTION_GENERATION: { label: "Geracao via PDF/Blueprint",    desc: "Ingestao de questoes de PDFs e blueprints AWS",                  group: "worker" },
  WORKER_QUALITY_REVIEW:      { label: "Revisao de Qualidade",         desc: "Revisao e descarte automatico de questoes baixa qualidade",      group: "worker" },
  WORKER_BLUEPRINT_PARSER:    { label: "Parser de Blueprint",          desc: "Extracao de dominios dos guias de exame AWS",                    group: "worker" },
  WORKER_EXAM_GUIDE:          { label: "Revisor de Guia de Exame",     desc: "Analise e revisao de guias de certificacao AWS",                 group: "worker" },
  WORKER_EMAIL:               { label: "Emails Personalizados",        desc: "Geracao de emails de estudo personalizados por aluno",           group: "worker" },
};

const APP_CONTEXTS: AiContext[] = [
  "QUESTION_EXPLAIN",
  "SIMULADO_MESSAGE",
  "LAB_GENERATION",
  "TRAIL_QUESTION_GENERATION",
];

const WORKER_CONTEXTS: AiContext[] = [
  "WORKER_KC_QUESTION",
  "WORKER_QUESTION_GENERATION",
  "WORKER_QUALITY_REVIEW",
  "WORKER_BLUEPRINT_PARSER",
  "WORKER_EXAM_GUIDE",
  "WORKER_EMAIL",
];

// ponytail: openrouter/free auto-routes to whatever is currently free — individual :free slugs go stale
export const FREE_MODELS = [
  { id: "openrouter/free",                                        name: "Auto (openrouter/free)", context: "varies", desc: "Selecao automatica do melhor modelo gratuito disponivel no momento (recomendado)" },
  { id: "google/gemma-3-4b-it:free",                             name: "Gemma 3 4B",             context: "8k",     desc: "Leve e rapido para geracao simples" },
  { id: "google/gemma-3-12b-it:free",                            name: "Gemma 3 12B",            context: "8k",     desc: "Melhor raciocinio que o 4B" },
  { id: "google/gemma-3-27b-it:free",                            name: "Gemma 3 27B",            context: "8k",     desc: "Maior qualidade da familia Gemma" },
  { id: "meta-llama/llama-3.2-3b-instruct:free",                 name: "Llama 3.2 3B",           context: "131k",   desc: "Contexto longo, bom para resumos" },
  { id: "meta-llama/llama-3.3-70b-instruct:free",                name: "Llama 3.3 70B",          context: "131k",   desc: "Excelente raciocinio e geracao" },
  { id: "meta-llama/llama-4-scout:free",                         name: "Llama 4 Scout",          context: "512k",   desc: "Contexto enorme, ideal p/ documentos longos" },
  { id: "meta-llama/llama-4-maverick:free",                      name: "Llama 4 Maverick",       context: "131k",   desc: "Llama 4 balanceado" },
  { id: "mistralai/mistral-7b-instruct:free",                    name: "Mistral 7B",             context: "32k",    desc: "Eficiente, bom equilibrio velocidade/qualidade" },
  { id: "mistralai/mistral-small-3.2-24b-instruct:free",         name: "Mistral Small 3.2 24B",  context: "128k",   desc: "Mistral com contexto longo" },
  { id: "qwen/qwen3-8b:free",                                    name: "Qwen 3 8B",              context: "40k",    desc: "Bom em codigo e multilingue (PT incluido)" },
  { id: "qwen/qwen3-14b:free",                                   name: "Qwen 3 14B",             context: "40k",    desc: "Versao maior, melhor qualidade" },
  { id: "qwen/qwen3-30b-a3b:free",                               name: "Qwen 3 30B MoE",         context: "40k",    desc: "Alta capacidade com MoE" },
  { id: "microsoft/phi-4-reasoning:free",                        name: "Phi-4 Reasoning",        context: "32k",    desc: "Focado em raciocinio passo a passo" },
  { id: "nvidia/llama-3.1-nemotron-70b-instruct:free",           name: "Nemotron 70B",           context: "131k",   desc: "Fine-tune NVIDIA sobre Llama 3.1" },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

type BenchmarkResult = {
  latencyMs: number;
  ttfbMs: number;
  tokens?: { prompt: number; completion: number };
  preview: string;
};

type ModuleState = {
  model: string;
  saving: boolean;
  error: string | null;
  success: boolean;
  benchmarkLoading: boolean;
  benchmarkResult: BenchmarkResult | null;
  benchmarkError: string | null;
};

function makeModuleState(model?: string): ModuleState {
  return {
    model: model ?? "",
    saving: false,
    error: null,
    success: false,
    benchmarkLoading: false,
    benchmarkResult: null,
    benchmarkError: null,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminAiConfigScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<AiContext, { model: string } | null> | null>(null);

  // Global key edit
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState(false);

  // Per-module state
  const [moduleStates, setModuleStates] = useState<Record<AiContext, ModuleState>>(
    {} as Record<AiContext, ModuleState>,
  );

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/ai-config", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar configuracoes");
      const data = (await res.json()) as {
        configs: Record<AiContext, { model: string } | null>;
        maskedKey: string | null;
      };
      setConfigs(data.configs);
      setMaskedKey(data.maskedKey);
      const states = {} as Record<AiContext, ModuleState>;
      for (const ctx of [...APP_CONTEXTS, ...WORKER_CONTEXTS] as AiContext[]) {
        states[ctx] = makeModuleState(data.configs[ctx]?.model);
      }
      setModuleStates(states);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function patchModule(ctx: AiContext, patch: Partial<ModuleState>) {
    setModuleStates((prev) => ({ ...prev, [ctx]: { ...prev[ctx], ...patch } }));
  }

  async function saveKey() {
    if (!apiKeyInput.trim()) {
      setKeyError("Informe a chave OpenRouter");
      return;
    }
    setKeySaving(true);
    setKeyError(null);
    setKeySuccess(false);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "key", apiKey: apiKeyInput }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setKeyError(String(data.error ?? "Erro ao salvar"));
      } else {
        setKeySuccess(true);
        setApiKeyInput("");
        await load();
      }
    } catch {
      setKeyError("Falha na requisicao");
    } finally {
      setKeySaving(false);
    }
  }

  async function saveModel(ctx: AiContext) {
    const state = moduleStates[ctx];
    if (!state?.model.trim()) {
      patchModule(ctx, { error: "Selecione ou informe um modelo" });
      return;
    }
    patchModule(ctx, { saving: true, error: null, success: false });
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "model", context: ctx, model: state.model }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        patchModule(ctx, { error: String(data.error ?? "Erro ao salvar") });
      } else {
        patchModule(ctx, { success: true });
        await load();
      }
    } catch {
      patchModule(ctx, { error: "Falha na requisicao" });
    } finally {
      patchModule(ctx, { saving: false });
    }
  }

  async function runBenchmark(ctx: AiContext) {
    const state = moduleStates[ctx];
    const model = state?.model || configs?.[ctx]?.model;
    if (!model) {
      patchModule(ctx, { benchmarkError: "Configure um modelo antes de testar" });
      return;
    }
    patchModule(ctx, { benchmarkLoading: true, benchmarkResult: null, benchmarkError: null });
    try {
      // apiKey is optional — backend uses the stored key if not provided
      const body: Record<string, string> = { model };
      if (apiKeyInput.trim()) body.apiKey = apiKeyInput.trim();
      const res = await fetch("/api/admin/ai-config/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as BenchmarkResult & { error?: string };
      if (!res.ok || data.error) {
        patchModule(ctx, { benchmarkError: data.error ?? "Erro no benchmark" });
      } else {
        patchModule(ctx, { benchmarkResult: data });
      }
    } catch {
      patchModule(ctx, { benchmarkError: "Falha na requisicao" });
    } finally {
      patchModule(ctx, { benchmarkLoading: false });
    }
  }

  if (loading) {
    return (
      <main className="space-y-5">
        <Header />
        <p className="text-xs text-[#94a3b8]">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <Header />

      {loadError && <p className="text-xs text-[#fca5a5]">{loadError}</p>}

      {/* ── Global key section ─────────────────────────────────────── */}
      <section className="border border-[#1e293b] bg-[#111827] p-4 space-y-3">
        <div className="space-y-0.5">
          <p className="font-mono text-xs uppercase text-[#f97316]">Chave Global OpenRouter</p>
          <p className="text-xs text-[#64748b]">
            Uma unica chave usada por todos os modulos.{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#94a3b8] underline"
            >
              Obter chave
            </a>
          </p>
          {maskedKey && (
            <p className="font-mono text-[10px] text-[#64748b]">Atual: {maskedKey}</p>
          )}
          {!maskedKey && (
            <p className="text-[10px] text-[#f97316]">Nao configurada</p>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKeyInput}
              onChange={(e) => { setApiKeyInput(e.target.value); setKeyError(null); setKeySuccess(false); }}
              placeholder="sk-or-..."
              className="flex-1 border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="border border-l-0 border-[#334155] bg-[#0b1220] px-3 py-2 text-xs text-[#94a3b8]"
            >
              {showKey ? "Ocultar" : "Ver"}
            </button>
          </div>
          <button
            type="button"
            disabled={keySaving}
            onClick={() => void saveKey()}
            className="border border-[#1e3a5f] bg-blue-900/20 px-4 py-2 text-xs uppercase text-blue-200 disabled:opacity-60"
          >
            {keySaving ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {keyError && <p className="text-xs text-[#fca5a5]">{keyError}</p>}
        {keySuccess && <p className="text-xs text-green-300">Chave salva com sucesso.</p>}
      </section>

      {/* ── App modules ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Modulos do App</p>
        {APP_CONTEXTS.map((ctx) => (
          <ModuleCard
            key={ctx}
            ctx={ctx}
            currentModel={configs?.[ctx]?.model ?? null}
            state={moduleStates[ctx] ?? makeModuleState()}
            onModelChange={(m) => patchModule(ctx, { model: m, error: null, success: false })}
            onSave={() => void saveModel(ctx)}
            onBenchmark={() => void runBenchmark(ctx)}
          />
        ))}
      </section>

      {/* ── Worker modules ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Modulos do Worker</p>
        {WORKER_CONTEXTS.map((ctx) => (
          <ModuleCard
            key={ctx}
            ctx={ctx}
            currentModel={configs?.[ctx]?.model ?? null}
            state={moduleStates[ctx] ?? makeModuleState()}
            onModelChange={(m) => patchModule(ctx, { model: m, error: null, success: false })}
            onSave={() => void saveModel(ctx)}
            onBenchmark={() => void runBenchmark(ctx)}
          />
        ))}
      </section>

      <section className="border border-[#1e293b] bg-[#111827] p-4 space-y-2">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Fallback de ambiente</p>
        <ul className="space-y-1 text-xs text-[#64748b]">
          <li><code className="text-[#e2e8f0]">OPENROUTER_API_KEY</code> — chave global (fallback do banco)</li>
          <li><code className="text-[#e2e8f0]">AI_MODEL</code> — modelo padrao (fallback: google/gemma-3-4b-it:free)</li>
          <li><code className="text-[#e2e8f0]">ENCRYPTION_KEY</code> — necessario para criptografar a chave no banco</li>
        </ul>
      </section>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="space-y-1">
      <p className="font-mono text-xs uppercase text-[#f97316]">Config</p>
      <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Configuracao de IA</h1>
      <p className="text-xs text-[#94a3b8]">
        Configure a chave global OpenRouter e o modelo por modulo. Chave armazenada criptografada (AES-256-GCM).
      </p>
    </header>
  );
}

type ModuleCardProps = {
  ctx: AiContext;
  currentModel: string | null;
  state: ModuleState;
  onModelChange: (model: string) => void;
  onSave: () => void;
  onBenchmark: () => void;
};

function ModuleCard({ ctx, currentModel, state, onModelChange, onSave, onBenchmark }: ModuleCardProps) {
  const meta = MODULE_META[ctx];

  return (
    <div className="border border-[#1e293b] bg-[#111827] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <p className="font-mono text-xs uppercase text-[#e2e8f0]">{meta.label}</p>
          <p className="text-[10px] text-[#64748b]">{ctx}</p>
          <p className="text-xs text-[#94a3b8]">{meta.desc}</p>
        </div>
        {currentModel && (
          <p className="font-mono text-[10px] text-[#64748b] shrink-0">{currentModel}</p>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <select
            value={state.model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">-- Selecione um modelo --</option>
            {FREE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.context}) — {m.desc}
              </option>
            ))}
            {state.model && !FREE_MODELS.find((m) => m.id === state.model) && (
              <option value={state.model}>{state.model}</option>
            )}
          </select>
        </div>
        <button
          type="button"
          disabled={state.saving}
          onClick={onSave}
          className="border border-[#14532d] bg-green-900/20 px-3 py-2 text-xs uppercase text-green-200 disabled:opacity-60 shrink-0"
        >
          {state.saving ? "..." : "Salvar"}
        </button>
        <button
          type="button"
          disabled={state.benchmarkLoading}
          onClick={onBenchmark}
          className="border border-[#1e3a5f] bg-blue-900/20 px-3 py-2 text-xs uppercase text-blue-200 disabled:opacity-60 shrink-0"
        >
          {state.benchmarkLoading ? "..." : "Testar"}
        </button>
      </div>

      {state.error && <p className="text-xs text-[#fca5a5]">{state.error}</p>}
      {state.success && <p className="text-xs text-green-300">Salvo.</p>}

      {state.benchmarkError && (
        <p className="text-xs text-[#fca5a5]">{state.benchmarkError}</p>
      )}
      {state.benchmarkResult && (
        <BenchmarkDisplay result={state.benchmarkResult} />
      )}
    </div>
  );
}

function BenchmarkDisplay({ result }: { result: BenchmarkResult }) {
  return (
    <div className="border border-[#1e293b] bg-[#0b1220] p-3 space-y-1">
      <div className="flex gap-4 text-[10px] font-mono text-[#94a3b8]">
        <span>Latencia: <span className="text-[#e2e8f0]">{result.latencyMs}ms</span></span>
        <span>TTFB: <span className="text-[#e2e8f0]">{result.ttfbMs}ms</span></span>
        {result.tokens && (
          <span>
            Tokens: <span className="text-[#e2e8f0]">{result.tokens.prompt}p / {result.tokens.completion}c</span>
          </span>
        )}
      </div>
      {result.preview && (
        <p className="text-[10px] text-[#64748b] line-clamp-3">{result.preview}</p>
      )}
    </div>
  );
}
