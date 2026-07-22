"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAdminEmailTemplate,
  deleteAdminEmailTemplate,
  listAdminEmailTemplates,
  listAdminUsers,
  sendAdminEmailTemplate,
  updateAdminEmailTemplate,
  getBehavioralEmailStatus,
  toggleBehavioralEmail,
  triggerBehavioralEmailAnalysis,
} from "@/features/admin/services/admin-api";
import { CheckSquare, Square } from "lucide-react";
import { AdminEmailTemplateItem, AdminUserListItem, BehavioralEmailStatus } from "@/features/admin/types";

type DraftState = {
  code: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  active: boolean;
};

const EMPTY_DRAFT: DraftState = {
  code: "",
  name: "",
  description: "",
  subject: "",
  html: "",
  text: "",
  active: true,
};

const STATIC_LOGO_URL =
  "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/simulado-artwork/android-chrome-512x512.png";

function renderPreview(template: string, name: string, appUrl: string): string {
  return template
    .replace(/{{\s*name\s*}}/gi, name)
    .replace(/{{\s*app_url\s*}}/gi, appUrl)
    .replace(/{{\s*logo_url\s*}}/gi, STATIC_LOGO_URL)
    .replace(/{{\s*reset_url\s*}}/gi, `${appUrl}/reset-password`)
    .replace(/{{\s*unsubscribe_url\s*}}/gi, `${appUrl}/api/user/unsubscribe?token=preview`);
}

const TRIGGER_LABELS: Record<string, string> = {
  churn_risk: "Risco de Churn",
  streak_milestone: "Streak 7 dias",
  score_improvement: "Melhora de Score",
  score_slump: "Queda de Score",
};

function AutomaticosStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-[#1e293b] bg-[#111827] p-3">
      <p className="font-mono text-[10px] uppercase text-[#64748b]">{title}</p>
      <p className="mt-2 font-mono text-lg uppercase text-[#f97316]">{value}</p>
    </div>
  );
}

export function AdminEmailScreen() {
  const [activeTab, setActiveTab] = useState<"templates" | "send" | "compose" | "automaticos">("templates");

  // Behavioral email state
  const [behavioralStatus, setBehavioralStatus] = useState<BehavioralEmailStatus | null>(null);
  const [behavioralLoading, setBehavioralLoading] = useState(false);
  const [behavioralError, setBehavioralError] = useState<string | null>(null);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  // Template management state
  const [templates, setTemplates] = useState<AdminEmailTemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(true);
  const [showPreviewPanel, setShowPreviewPanel] = useState(true);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("Aluno AWS");
  const [previewAppUrl, setPreviewAppUrl] = useState(
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  );

  // Send tab state
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendTemplateId, setSendTemplateId] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<"all-users" | "single-user">("all-users");
  const [userSearch, setUserSearch] = useState("");
  const [userOptions, setUserOptions] = useState<AdminUserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  // Compose tab state — write a one-off subject+html without saving it as a template
  const [composeSubject, setComposeSubject] = useState("");
  const [composeHtml, setComposeHtml] = useState("");
  const [composeTargetMode, setComposeTargetMode] = useState<"all-users" | "specific-users">("all-users");
  const [composeUserSearch, setComposeUserSearch] = useState("");
  const [composeUserOptions, setComposeUserOptions] = useState<AdminUserListItem[]>([]);
  const [composeSelectedUserIds, setComposeSelectedUserIds] = useState<Set<string>>(new Set());
  const [composeSending, setComposeSending] = useState(false);
  const [composeMessage, setComposeMessage] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);

  const selectedTemplateIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedTemplateIdRef.current = selectedTemplateId;
  }, [selectedTemplateId]);

  const loadTemplates = useCallback(async (input?: { preserveSelectionId?: string | null; keepNewMode?: boolean }) => {
    setLoading(true);
    setError(null);

    try {
      const data = await listAdminEmailTemplates();
      setTemplates(data);

      if (input?.keepNewMode) {
        setIsCreatingNew(true);
        setSelectedTemplateId(null);
        setDraft(EMPTY_DRAFT);
        return;
      }

      if (data.length === 0) {
        setIsCreatingNew(true);
        setSelectedTemplateId(null);
        setDraft(EMPTY_DRAFT);
        return;
      }

      const targetId = input?.preserveSelectionId ?? selectedTemplateIdRef.current;
      const selected = targetId ? data.find((item) => item.id === targetId) : data[0];

      if (selected) {
        setIsCreatingNew(false);
        setSelectedTemplateId(selected.id);
        setDraft({
          code: selected.code,
          name: selected.name,
          description: selected.description ?? "",
          subject: selected.subject,
          html: selected.html,
          text: selected.text ?? "",
          active: selected.active,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar templates de email.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      if (targetMode !== "single-user") return;

      try {
        const data = await listAdminUsers({
          page: 1,
          pageSize: 20,
          role: "user",
          active: "true",
          accessStatus: "approved",
          search: userSearch,
        });
        if (!cancelled) setUserOptions(data.items);
      } catch {
        if (!cancelled) setUserOptions([]);
      }
    }

    void loadUsers();
    return () => { cancelled = true; };
  }, [targetMode, userSearch]);

  useEffect(() => {
    let cancelled = false;

    async function loadComposeUsers() {
      if (activeTab !== "compose" || composeTargetMode !== "specific-users") return;

      try {
        const data = await listAdminUsers({
          page: 1,
          pageSize: 20,
          role: "user",
          active: "true",
          accessStatus: "approved",
          search: composeUserSearch,
        });
        if (!cancelled) setComposeUserOptions(data.items);
      } catch {
        if (!cancelled) setComposeUserOptions([]);
      }
    }

    void loadComposeUsers();
    return () => { cancelled = true; };
  }, [activeTab, composeTargetMode, composeUserSearch]);

  useEffect(() => {
    if (activeTab !== "automaticos") return;
    let cancelled = false;

    async function loadBehavioral() {
      setBehavioralLoading(true);
      setBehavioralError(null);
      try {
        const data = await getBehavioralEmailStatus();
        if (!cancelled) setBehavioralStatus(data);
      } catch (err) {
        if (!cancelled) setBehavioralError(err instanceof Error ? err.message : "Falha ao carregar emails automaticos.");
      } finally {
        if (!cancelled) setBehavioralLoading(false);
      }
    }

    void loadBehavioral();
    return () => { cancelled = true; };
  }, [activeTab]);

  async function handleToggleBehavioral(enabled: boolean) {
    try {
      await toggleBehavioralEmail(enabled);
      setBehavioralStatus((prev) => prev ? { ...prev, enabled } : prev);
    } catch (err) {
      setBehavioralError(err instanceof Error ? err.message : "Falha ao alterar configuracao.");
    }
  }

  async function handleTriggerAnalysis() {
    setTriggerLoading(true);
    setTriggerMessage(null);
    try {
      await triggerBehavioralEmailAnalysis();
      setTriggerMessage("Analise enfileirada. O worker processara em instantes.");
    } catch (err) {
      setBehavioralError(err instanceof Error ? err.message : "Falha ao acionar analise.");
    } finally {
      setTriggerLoading(false);
    }
  }

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const sendTemplate = useMemo(
    () => templates.find((item) => item.id === sendTemplateId) ?? null,
    [templates, sendTemplateId],
  );

  const contentColumnsClass = showTemplatesPanel
    ? "grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"
    : "grid gap-4 xl:grid-cols-[minmax(0,1fr)]";

  const editorColumnsClass = showPreviewPanel
    ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]"
    : "grid gap-4 xl:grid-cols-[minmax(0,1fr)]";

  function handleSelectTemplate(template: AdminEmailTemplateItem) {
    setIsCreatingNew(false);
    setSelectedTemplateId(template.id);
    setDraft({
      code: template.code,
      name: template.name,
      description: template.description ?? "",
      subject: template.subject,
      html: template.html,
      text: template.text ?? "",
      active: template.active,
    });
    setMessage(null);
    setError(null);
  }

  async function handleSaveTemplate() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      if (isCreatingNew || !selectedTemplate) {
        const created = await createAdminEmailTemplate({
          code: draft.code,
          name: draft.name,
          description: draft.description,
          subject: draft.subject,
          html: draft.html,
          text: draft.text,
          active: draft.active,
        });
        setMessage("Template criado com sucesso.");
        setIsCreatingNew(false);
        await loadTemplates({ preserveSelectionId: created.id });
      } else {
        await updateAdminEmailTemplate(selectedTemplate.id, {
          name: draft.name,
          description: draft.description,
          subject: draft.subject,
          html: draft.html,
          text: draft.text,
          active: draft.active,
        });
        setMessage("Template atualizado com sucesso.");
        await loadTemplates({ preserveSelectionId: selectedTemplate.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplate) return;
    if (!window.confirm("Deseja remover este template?")) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await deleteAdminEmailTemplate(selectedTemplate.id);
      setMessage("Template removido com sucesso.");
      setSelectedTemplateId(null);
      setIsCreatingNew(true);
      setDraft(EMPTY_DRAFT);
      await loadTemplates({ keepNewMode: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTemplate() {
    if (!sendTemplate) {
      setSendError("Selecione um template para enviar.");
      return;
    }

    if (targetMode === "single-user" && !selectedUserId) {
      setSendError("Selecione um usuario para envio individual.");
      return;
    }

    setSending(true);
    setSendMessage(null);
    setSendError(null);

    try {
      await sendAdminEmailTemplate({
        templateId: sendTemplate.id,
        targetMode,
        userId: targetMode === "single-user" ? selectedUserId : undefined,
      });

      setSendMessage(
        targetMode === "single-user"
          ? "Email enfileirado para envio pelo worker. O destinatario recebera em instantes."
          : "Emails enfileirados para todos os usuarios aprovados. O worker processara o envio em segundo plano.",
      );
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Falha ao enviar template.");
    } finally {
      setSending(false);
    }
  }

  function toggleComposeUser(userId: string) {
    setComposeSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSendCompose() {
    if (!composeSubject.trim() || !composeHtml.trim()) {
      setComposeError("Preencha o assunto e o conteudo do email.");
      return;
    }

    if (composeTargetMode === "specific-users" && composeSelectedUserIds.size === 0) {
      setComposeError("Selecione ao menos um usuario.");
      return;
    }

    setComposeSending(true);
    setComposeMessage(null);
    setComposeError(null);

    try {
      await sendAdminEmailTemplate({
        subject: composeSubject,
        html: composeHtml,
        targetMode: composeTargetMode,
        userIds: composeTargetMode === "specific-users" ? Array.from(composeSelectedUserIds) : undefined,
      });

      setComposeMessage(
        composeTargetMode === "specific-users"
          ? `Email enfileirado para ${composeSelectedUserIds.size} usuario(s) selecionado(s).`
          : "Email enfileirado para todos os usuarios aprovados. O worker processara o envio em segundo plano.",
      );
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : "Falha ao enviar email.");
    } finally {
      setComposeSending(false);
    }
  }

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Admin Email</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gestao de templates e envio</h1>
        <p className="text-sm text-[#94a3b8]">
          Variaveis suportadas: {"{{name}}"}, {"{{app_url}}"}, {"{{logo_url}}"}, {"{{reset_url}}"}.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1e293b]">
        {(["templates", "send", "compose", "automaticos"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-mono text-[10px] uppercase transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[#f97316] text-[#f97316]"
                : "text-[#94a3b8] hover:text-[#cbd5e1]"
            }`}
          >
            {tab === "templates" ? "Templates" : tab === "send" ? "Envio" : tab === "compose" ? "Escrever" : "Automaticos"}
          </button>
        ))}
      </div>

      {/* Tab: Templates */}
      {activeTab === "templates" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border border-[#1e293b] bg-[#111827] p-3">
            <p className="font-mono text-[11px] uppercase text-[#94a3b8]">Layout</p>
            <button
              type="button"
              onClick={() => setShowTemplatesPanel((prev) => !prev)}
              className="border border-[#334155] px-2 py-1 text-[10px] uppercase text-[#cbd5e1]"
            >
              {showTemplatesPanel ? "Ocultar menu templates" : "Mostrar menu templates"}
            </button>
            <button
              type="button"
              onClick={() => setShowPreviewPanel((prev) => !prev)}
              className="border border-[#334155] px-2 py-1 text-[10px] uppercase text-[#cbd5e1]"
            >
              {showPreviewPanel ? "Ocultar preview" : "Mostrar preview"}
            </button>
          </div>

          <div className={contentColumnsClass}>
            {showTemplatesPanel && (
              <div className="space-y-3 border border-[#1e293b] bg-[#111827] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs uppercase text-[#cbd5e1]">Templates</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(true);
                      setSelectedTemplateId(null);
                      setDraft(EMPTY_DRAFT);
                      setMessage(null);
                      setError(null);
                    }}
                    className="border border-[#334155] px-2 py-1 text-[10px] uppercase"
                  >
                    Novo
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void loadTemplates()}
                  className="w-full border border-[#334155] px-2 py-2 text-xs uppercase"
                >
                  {loading ? "Atualizando..." : "Atualizar lista"}
                </button>

                <div className="max-h-[460px] space-y-2 overflow-auto">
                  {templates.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTemplate(item)}
                      className={`w-full border px-2 py-2 text-left ${selectedTemplateId === item.id ? "border-[#f97316] bg-[#0f172a]" : "border-[#334155]"}`}
                    >
                      <p className="text-xs uppercase text-[#e2e8f0]">{item.name}</p>
                      <p className="text-[10px] uppercase text-[#94a3b8]">
                        {item.code} | {item.isSystem ? "sistema" : "custom"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={editorColumnsClass}>
              <div className="space-y-4 border border-[#1e293b] bg-[#111827] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs uppercase text-[#cbd5e1]">
                    {isCreatingNew ? "Criar template" : "Editar template"}
                  </p>
                  {selectedTemplate && (
                    <span className="text-[10px] uppercase text-[#94a3b8]">
                      {selectedTemplate.isSystem ? "Template de sistema" : "Template custom"}
                    </span>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs uppercase text-[#94a3b8]">
                    Code
                    <input
                      value={draft.code}
                      onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
                      disabled={Boolean(selectedTemplate?.isSystem) && !isCreatingNew}
                      className="w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-sm text-[#e2e8f0]"
                    />
                  </label>

                  <label className="space-y-1 text-xs uppercase text-[#94a3b8]">
                    Nome
                    <input
                      value={draft.name}
                      onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                      className="w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-sm text-[#e2e8f0]"
                    />
                  </label>

                  <label className="space-y-1 text-xs uppercase text-[#94a3b8] md:col-span-2">
                    Descricao
                    <input
                      value={draft.description}
                      onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                      className="w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-sm text-[#e2e8f0]"
                    />
                  </label>

                  <label className="space-y-1 text-xs uppercase text-[#94a3b8] md:col-span-2">
                    Subject
                    <input
                      value={draft.subject}
                      onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
                      className="w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-sm text-[#e2e8f0]"
                    />
                  </label>

                  <label className="space-y-1 text-xs uppercase text-[#94a3b8] md:col-span-2">
                    HTML
                    <textarea
                      value={draft.html}
                      onChange={(event) => setDraft((prev) => ({ ...prev, html: event.target.value }))}
                      className="min-h-[180px] w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-xs text-[#e2e8f0]"
                    />
                  </label>

                  <label className="space-y-1 text-xs uppercase text-[#94a3b8] md:col-span-2">
                    Texto alternativo
                    <textarea
                      value={draft.text}
                      onChange={(event) => setDraft((prev) => ({ ...prev, text: event.target.value }))}
                      className="min-h-[100px] w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-xs text-[#e2e8f0]"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-xs uppercase text-[#94a3b8]">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(event) => setDraft((prev) => ({ ...prev, active: event.target.checked }))}
                    />
                    Ativo
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveTemplate()}
                    disabled={saving}
                    className="border border-[#f97316] px-3 py-2 text-xs uppercase text-[#f97316]"
                  >
                    {saving ? "Salvando..." : isCreatingNew ? "Criar template" : "Salvar alteracoes"}
                  </button>

                  {!isCreatingNew && selectedTemplate && !selectedTemplate.isSystem && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteTemplate()}
                      disabled={saving}
                      className="border border-[#7f1d1d] px-3 py-2 text-xs uppercase text-[#fca5a5]"
                    >
                      Remover template
                    </button>
                  )}
                </div>

                {message && <p className="text-sm text-[#86efac]">{message}</p>}
                {error && <p className="text-sm text-[#fca5a5]">{error}</p>}
              </div>

              {showPreviewPanel && (
                <aside className="space-y-2 border border-[#1e293b] bg-[#111827] p-3 xl:sticky xl:top-4">
                  <p className="font-mono text-xs uppercase text-[#cbd5e1]">Preview do email</p>
                  <input
                    value={previewName}
                    onChange={(event) => setPreviewName(event.target.value)}
                    placeholder="Nome para preview"
                    className="w-full border border-[#334155] bg-[#111827] px-2 py-2 text-sm text-[#e2e8f0]"
                  />
                  <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase text-[#94a3b8]">URL do app ({previewAppUrl})</p>
                    <input
                      value={previewAppUrl}
                      onChange={(event) => setPreviewAppUrl(event.target.value)}
                      placeholder="https://seuapp.com"
                      className="w-full border border-[#334155] bg-[#111827] px-2 py-2 text-sm text-[#e2e8f0]"
                    />
                    <p className="text-[10px] text-[#475569]">
                      Usada nos links do preview. No envio real, usa a variavel APP_URL do servidor.
                    </p>
                  </div>
                  <div className="max-h-[80vh] overflow-auto rounded border border-[#334155] bg-secondary p-2">
                    <div
                      className="min-h-[240px]"
                      dangerouslySetInnerHTML={{
                        __html: renderPreview(draft.html || "<p>Sem HTML para preview.</p>", previewName, previewAppUrl),
                      }}
                    />
                  </div>
                </aside>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tab: Envio */}
      {activeTab === "send" && (
        <section className="space-y-5">
          <p className="text-sm text-[#94a3b8]">
            Selecione um template, escolha o destino e enfileire o envio via worker.
          </p>

          {/* Template card grid */}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase text-[#94a3b8]">1. Escolha o template</p>
            {templates.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">Nenhum template disponivel.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setSendTemplateId(item.id); setSendMessage(null); setSendError(null); }}
                    className={`border p-3 text-left transition-colors ${
                      sendTemplateId === item.id
                        ? "border-[#f97316] bg-[#f9731615]"
                        : "border-[#334155] bg-[#111827] hover:border-[#475569]"
                    }`}
                  >
                    <p className="font-mono text-xs uppercase text-[#e2e8f0]">{item.name}</p>
                    <p className="mt-1 text-[10px] text-[#94a3b8]">{item.subject}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase text-[#475569]">
                      {item.code} · {item.isSystem ? "sistema" : "custom"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send form */}
          <div className="space-y-4 border border-[#1e293b] bg-[#111827] p-4">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">2. Configurar envio</p>

            {sendTemplate ? (
              <p className="text-xs text-[#86efac]">
                Template selecionado: <span className="font-mono uppercase">{sendTemplate.name}</span>
              </p>
            ) : (
              <p className="text-xs text-[#94a3b8]">Nenhum template selecionado acima.</p>
            )}

            <div className="flex flex-wrap gap-3 text-xs uppercase">
              <label className="flex items-center gap-2 text-[#cbd5e1]">
                <input
                  type="radio"
                  checked={targetMode === "all-users"}
                  onChange={() => setTargetMode("all-users")}
                />
                Todos os usuarios aprovados
              </label>
              <label className="flex items-center gap-2 text-[#cbd5e1]">
                <input
                  type="radio"
                  checked={targetMode === "single-user"}
                  onChange={() => setTargetMode("single-user")}
                />
                Usuario especifico
              </label>
            </div>

            {targetMode === "single-user" && (
              <div className="space-y-2">
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Buscar usuario por nome/email"
                  className="w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-sm text-[#e2e8f0]"
                />
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  className="w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-sm text-[#e2e8f0]"
                >
                  <option value="">Selecione um usuario</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSendTemplate()}
              disabled={sending || !sendTemplate}
              className="border border-[#22c55e] px-4 py-2 text-xs uppercase text-[#86efac] disabled:opacity-40"
            >
              {sending ? "Enfileirando..." : "Enfileirar Envio"}
            </button>

            {sendMessage && (
              <div className="space-y-2 border border-green-800 bg-green-900/15 px-4 py-3">
                <p className="text-sm text-[#86efac]">{sendMessage}</p>
                <p className="text-xs text-[#4ade80]">
                  Acompanhe o status em{" "}
                  <Link href="/admin?tab=worker" className="underline hover:text-white">
                    Admin → Worker
                  </Link>
                  .
                </p>
              </div>
            )}
            {sendError && <p className="text-sm text-[#fca5a5]">{sendError}</p>}
          </div>
        </section>
      )}

      {/* Tab: Escrever (envio avulso, sem template salvo) */}
      {activeTab === "compose" && (
        <section className="space-y-4">
          <p className="text-sm text-[#94a3b8]">
            Escreva um email avulso — nao precisa ser um template salvo. As mesmas variaveis dos templates funcionam
            aqui: {"{{name}}"}, {"{{app_url}}"}, {"{{logo_url}}"}, {"{{unsubscribe_url}}"}.
          </p>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4 border border-[#1e293b] bg-[#111827] p-4">
              <label className="space-y-1 text-xs uppercase text-[#94a3b8]">
                Assunto
                <input
                  value={composeSubject}
                  onChange={(event) => setComposeSubject(event.target.value)}
                  placeholder="Assunto do email"
                  className="w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-sm text-[#e2e8f0]"
                />
              </label>

              <label className="space-y-1 text-xs uppercase text-[#94a3b8]">
                Conteudo (HTML)
                <textarea
                  value={composeHtml}
                  onChange={(event) => setComposeHtml(event.target.value)}
                  placeholder="<p>Ola {{name}}, ...</p>"
                  className="min-h-[260px] w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-xs text-[#e2e8f0]"
                />
              </label>

              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Destinatarios</p>
                <div className="flex flex-wrap gap-3 text-xs uppercase">
                  <label className="flex items-center gap-2 text-[#cbd5e1]">
                    <input
                      type="radio"
                      checked={composeTargetMode === "all-users"}
                      onChange={() => setComposeTargetMode("all-users")}
                    />
                    Todos os usuarios aprovados
                  </label>
                  <label className="flex items-center gap-2 text-[#cbd5e1]">
                    <input
                      type="radio"
                      checked={composeTargetMode === "specific-users"}
                      onChange={() => setComposeTargetMode("specific-users")}
                    />
                    Usuarios especificos
                  </label>
                </div>

                {composeTargetMode === "specific-users" && (
                  <div className="space-y-2">
                    <input
                      value={composeUserSearch}
                      onChange={(event) => setComposeUserSearch(event.target.value)}
                      placeholder="Buscar usuario por nome/email"
                      className="w-full border border-[#334155] bg-[#0b1220] px-2 py-2 text-sm text-[#e2e8f0]"
                    />
                    <div className="max-h-[220px] space-y-1 overflow-auto border border-[#334155] p-2">
                      {composeUserOptions.length === 0 && (
                        <p className="text-xs text-[#64748b]">Nenhum usuario encontrado.</p>
                      )}
                      {composeUserOptions.map((user) => {
                        const selected = composeSelectedUserIds.has(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleComposeUser(user.id)}
                            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs ${
                              selected ? "bg-[#f9731615] text-[#f97316]" : "text-[#cbd5e1] hover:bg-[#0b1220]"
                            }`}
                          >
                            {selected ? <CheckSquare size={13} /> : <Square size={13} />}
                            {user.name} ({user.email})
                          </button>
                        );
                      })}
                    </div>
                    {composeSelectedUserIds.size > 0 && (
                      <p className="text-[10px] uppercase text-[#94a3b8]">
                        {composeSelectedUserIds.size} usuario(s) selecionado(s)
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleSendCompose()}
                disabled={composeSending}
                className="border border-[#22c55e] px-4 py-2 text-xs uppercase text-[#86efac] disabled:opacity-40"
              >
                {composeSending ? "Enfileirando..." : "Enfileirar Envio"}
              </button>

              {composeMessage && <p className="text-sm text-[#86efac]">{composeMessage}</p>}
              {composeError && <p className="text-sm text-[#fca5a5]">{composeError}</p>}
            </div>

            <aside className="space-y-2 border border-[#1e293b] bg-[#111827] p-3 xl:sticky xl:top-4">
              <p className="font-mono text-xs uppercase text-[#cbd5e1]">Preview do email</p>
              <input
                value={previewName}
                onChange={(event) => setPreviewName(event.target.value)}
                placeholder="Nome para preview"
                className="w-full border border-[#334155] bg-[#111827] px-2 py-2 text-sm text-[#e2e8f0]"
              />
              <input
                value={previewAppUrl}
                onChange={(event) => setPreviewAppUrl(event.target.value)}
                placeholder="https://seuapp.com"
                className="w-full border border-[#334155] bg-[#111827] px-2 py-2 text-sm text-[#e2e8f0]"
              />
              <div className="max-h-[80vh] overflow-auto rounded border border-[#334155] bg-secondary p-2">
                <div
                  className="min-h-[240px]"
                  dangerouslySetInnerHTML={{
                    __html: renderPreview(composeHtml || "<p>Sem HTML para preview.</p>", previewName, previewAppUrl),
                  }}
                />
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* Tab: Automaticos */}
      {activeTab === "automaticos" && (
        <section className="space-y-5">
          <p className="text-sm text-[#94a3b8]">
            Emails personalizados gerados por IA e enviados automaticamente com base no comportamento do usuario.
          </p>

          {behavioralLoading && (
            <p className="font-mono text-xs uppercase text-[#94a3b8]">Carregando...</p>
          )}

          {behavioralError && (
            <p className="text-sm text-[#fca5a5]">{behavioralError}</p>
          )}

          {!behavioralLoading && behavioralStatus && (
            <>
              {/* Toggle card */}
              <div className="space-y-3 border border-[#1e293b] bg-[#111827] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase text-[#e2e8f0]">Emails Automaticos com IA</p>
                    <p className="mt-1 text-xs text-[#94a3b8]">
                      Analisa comportamento e envia emails personalizados para engajar usuarios.
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs uppercase text-[#94a3b8]">
                    <input
                      type="checkbox"
                      checked={behavioralStatus.enabled}
                      onChange={(e) => void handleToggleBehavioral(e.target.checked)}
                      className="h-4 w-4 accent-[#f97316]"
                    />
                    {behavioralStatus.enabled ? (
                      <span className="text-[#86efac]">Ativado</span>
                    ) : (
                      <span className="text-[#94a3b8]">Desativado</span>
                    )}
                  </label>
                </div>
              </div>

              {/* Stats */}
              <div className="grid gap-3 sm:grid-cols-3">
                <AutomaticosStat title="Enviados esta semana" value={String(behavioralStatus.stats.sentThisWeek)} />
                <AutomaticosStat title="Enviados este mes" value={String(behavioralStatus.stats.sentThisMonth)} />
                <AutomaticosStat
                  title="Ultima analise"
                  value={
                    behavioralStatus.stats.lastAnalyzedAt
                      ? behavioralStatus.stats.lastAnalyzedAt.slice(0, 16).replace("T", " ")
                      : "—"
                  }
                />
              </div>

              {/* Manual trigger */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleTriggerAnalysis()}
                  disabled={triggerLoading}
                  className="border border-[#f97316] px-4 py-2 font-mono text-xs uppercase text-[#f97316] disabled:opacity-40"
                >
                  {triggerLoading ? "Enfileirando..." : "Analisar Agora"}
                </button>
                {triggerMessage && <p className="text-xs text-[#86efac]">{triggerMessage}</p>}
              </div>

              {/* Recent events table */}
              {behavioralStatus.recentEvents.length > 0 && (
                <div className="border border-[#1e293b] bg-[#111827]">
                  <div className="border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
                    <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Emails recentes enviados</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#1e293b] text-[#64748b]">
                          <th className="px-4 py-2 font-mono uppercase">Usuario</th>
                          <th className="px-4 py-2 font-mono uppercase">Trigger</th>
                          <th className="px-4 py-2 font-mono uppercase">Assunto</th>
                          <th className="px-4 py-2 font-mono uppercase">Enviado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {behavioralStatus.recentEvents.map((event) => (
                          <tr key={event.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-[#0b1220]">
                            <td className="px-4 py-2">
                              <p className="text-[#e2e8f0]">{event.userName}</p>
                              <p className="text-[10px] text-[#94a3b8]">{event.userEmail}</p>
                            </td>
                            <td className="px-4 py-2 font-mono text-[#f97316]">
                              {TRIGGER_LABELS[event.triggerCode] ?? event.triggerCode}
                            </td>
                            <td className="max-w-[240px] truncate px-4 py-2 text-[#94a3b8]">{event.subject}</td>
                            <td className="px-4 py-2 font-mono text-[#94a3b8]">
                              {event.sentAt.slice(0, 16).replace("T", " ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {behavioralStatus.recentEvents.length === 0 && (
                <p className="text-xs text-[#94a3b8]">Nenhum email automatico enviado ainda.</p>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
