"use client";

import { useEffect, useState } from "react";

type AiContext = "QUESTION_GENERATION" | "QUESTION_EXPLAIN" | "SIMULADO_MESSAGE" | "LAB_GENERATION";

const CONTEXT_LABELS: Record<AiContext, string> = {
  QUESTION_GENERATION: "Geracao de questoes",
  QUESTION_EXPLAIN: "Explicacao de questoes",
  SIMULADO_MESSAGE: "Mensagem motivacional",
  LAB_GENERATION: "Geracao de labs",
};

const CONTEXT_DESCRIPTIONS: Record<AiContext, string> = {
  QUESTION_GENERATION: "Modelo usado para gerar novas questoes a partir de blueprints e fontes ingeridas.",
  QUESTION_EXPLAIN: "Modelo usado para gerar explicacoes e feedback em questoes individuais.",
  SIMULADO_MESSAGE: "Modelo usado para gerar a mensagem motivacional ao finalizar um simulado.",
  LAB_GENERATION: "Modelo usado para gerar labs praticos baseados em servicos AWS.",
};

const AI_CONTEXTS: AiContext[] = [
  "QUESTION_GENERATION",
  "QUESTION_EXPLAIN",
  "SIMULADO_MESSAGE",
  "LAB_GENERATION",
];

const SUGGESTED_MODELS = [
  "google:gemini-2.0-flash-exp",
  "google:gemini-1.5-pro",
  "google:gemini-1.5-flash",
  "google:gemma-3-4b-it",
  "openai:gpt-4o",
  "openai:gpt-4o-mini",
  "openai:gpt-3.5-turbo",
  "anthropic:claude-3-5-sonnet-20241022",
  "anthropic:claude-3-haiku-20240307",
];

type ContextConfig = { model: string; maskedKey: string } | null;

type EditState = {
  model: string;
  apiKey: string;
  showKey: boolean;
  saving: boolean;
  error: string | null;
  success: boolean;
};

function makeEditState(existing: ContextConfig): EditState {
  return {
    model: existing?.model ?? "",
    apiKey: "",
    showKey: false,
    saving: false,
    error: null,
    success: false,
  };
}

export function AdminAiConfigScreen() {
  const [configs, setConfigs] = useState<Record<AiContext, ContextConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<AiContext, EditState>>({} as Record<AiContext, EditState>);
  const [expandedContext, setExpandedContext] = useState<AiContext | null>(null);

  useEffect(() => {
    void fetchConfigs();
  }, []);

  async function fetchConfigs() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/ai-config", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar configuracoes");
      const data = (await res.json()) as { configs: Record<AiContext, ContextConfig> };
      setConfigs(data.configs);
      const states = {} as Record<AiContext, EditState>;
      for (const ctx of AI_CONTEXTS) {
        states[ctx] = makeEditState(data.configs[ctx]);
      }
      setEditStates(states);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function updateEdit(ctx: AiContext, patch: Partial<EditState>) {
    setEditStates((prev) => ({ ...prev, [ctx]: { ...prev[ctx], ...patch } }));
  }

  async function handleSave(ctx: AiContext) {
    const state = editStates[ctx];
    if (!state) return;
    if (!state.model.trim()) {
      updateEdit(ctx, { error: "Informe o modelo (ex: google:gemini-1.5-pro)" });
      return;
    }
    if (!state.apiKey.trim()) {
      updateEdit(ctx, { error: "Informe a chave de API" });
      return;
    }
    updateEdit(ctx, { saving: true, error: null, success: false });
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ context: ctx, model: state.model, apiKey: state.apiKey }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        updateEdit(ctx, { error: String(data.error ?? "Erro ao salvar") });
      } else {
        updateEdit(ctx, { success: true, apiKey: "" });
        await fetchConfigs();
      }
    } catch {
      updateEdit(ctx, { error: "Falha na requisicao" });
    } finally {
      updateEdit(ctx, { saving: false });
    }
  }

  if (loading) {
    return (
      <main className="space-y-5">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase text-[#f97316]">Config</p>
          <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Config de IA</h1>
        </header>
        <p className="text-xs text-[#94a3b8]">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase text-[#f97316]">Config</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Configuracao de modelos de IA</h1>
        <p className="text-xs text-[#94a3b8]">
          Configure o modelo e a chave de API para cada contexto. As chaves sao armazenadas criptografadas (AES-256-GCM).
          Se nao configurado, o sistema usa as variaveis de ambiente GEMINI_API_KEY / GEMINI_MODEL.
        </p>
      </header>

      {loadError && <p className="text-xs text-[#fca5a5]">{loadError}</p>}

      <div className="space-y-3">
        {AI_CONTEXTS.map((ctx) => {
          const existing = configs?.[ctx] ?? null;
          const state = editStates[ctx];
          const isOpen = expandedContext === ctx;

          return (
            <div key={ctx} className="border border-[#1e293b] bg-[#111827]">
              <button
                type="button"
                onClick={() => setExpandedContext(isOpen ? null : ctx)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="space-y-0.5">
                  <p className="font-mono text-xs uppercase text-[#e2e8f0]">{CONTEXT_LABELS[ctx]}</p>
                  <p className="text-xs text-[#64748b]">{ctx}</p>
                </div>
                <div className="flex items-center gap-3">
                  {existing ? (
                    <div className="text-right">
                      <p className="text-xs text-[#94a3b8]">{existing.model}</p>
                      <p className="font-mono text-[10px] text-[#64748b]">{existing.maskedKey}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-[#64748b]">Nao configurado</span>
                  )}
                  <span className="text-[#64748b]">{isOpen ? "▾" : "▸"}</span>
                </div>
              </button>

              {isOpen && state && (
                <div className="space-y-4 border-t border-[#1e293b] px-4 pb-4 pt-3">
                  <p className="text-xs text-[#94a3b8]">{CONTEXT_DESCRIPTIONS[ctx]}</p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs uppercase text-[#64748b]">Modelo</span>
                      <input
                        list={`models-${ctx}`}
                        value={state.model}
                        onChange={(e) => updateEdit(ctx, { model: e.target.value, error: null, success: false })}
                        placeholder="google:gemini-1.5-pro"
                        className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
                      />
                      <datalist id={`models-${ctx}`}>
                        {SUGGESTED_MODELS.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs uppercase text-[#64748b]">Chave de API</span>
                      <div className="flex">
                        <input
                          type={state.showKey ? "text" : "password"}
                          value={state.apiKey}
                          onChange={(e) => updateEdit(ctx, { apiKey: e.target.value, error: null, success: false })}
                          placeholder={existing ? "(deixe vazio para manter atual)" : "Informe a chave de API"}
                          className="flex-1 border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateEdit(ctx, { showKey: !state.showKey })}
                          className="border border-l-0 border-[#334155] bg-[#0b1220] px-3 py-2 text-xs text-[#94a3b8]"
                        >
                          {state.showKey ? "Ocultar" : "Ver"}
                        </button>
                      </div>
                      {existing && !state.apiKey && (
                        <p className="text-[10px] text-[#64748b]">Chave atual: {existing.maskedKey}</p>
                      )}
                    </label>
                  </div>

                  {state.error && (
                    <p className="text-xs text-[#fca5a5]">{state.error}</p>
                  )}
                  {state.success && (
                    <p className="text-xs text-green-300">Configuracao salva com sucesso.</p>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={state.saving}
                      onClick={() => void handleSave(ctx)}
                      className="border border-[#14532d] bg-green-900/20 px-4 py-2 text-xs uppercase text-green-200 disabled:opacity-60"
                    >
                      {state.saving ? "Salvando..." : "Salvar configuracao"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="border border-[#1e293b] bg-[#111827] p-4 space-y-2">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Fallback</p>
        <p className="text-xs text-[#64748b]">
          Quando nao configurado via banco, o sistema usa as variaveis de ambiente:
        </p>
        <ul className="space-y-1 text-xs text-[#64748b]">
          <li><code className="text-[#e2e8f0]">GEMINI_API_KEY</code> — chave da Google AI</li>
          <li><code className="text-[#e2e8f0]">GEMINI_MODEL</code> — modelo padrao (ex: gemma-3-4b-it)</li>
          <li><code className="text-[#e2e8f0]">ENCRYPTION_KEY</code> — necessario para criptografar chaves salvas no banco</li>
        </ul>
      </section>
    </main>
  );
}
