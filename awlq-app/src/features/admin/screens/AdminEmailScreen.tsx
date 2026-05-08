"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAdminEmailTemplate,
  deleteAdminEmailTemplate,
  listAdminEmailTemplates,
  listAdminUsers,
  sendAdminEmailTemplate,
  updateAdminEmailTemplate,
} from "@/features/admin/services/admin-api";
import { AdminEmailTemplateItem, AdminUserListItem } from "@/features/admin/types";

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

function renderPreview(template: string, name: string): string {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const logoUrl = `${appUrl}/icon.png`;

  return template
    .replace(/{{\s*name\s*}}/gi, name)
    .replace(/{{\s*app_url\s*}}/gi, appUrl)
    .replace(/{{\s*logo_url\s*}}/gi, logoUrl);
}

export function AdminEmailScreen() {
  const [templates, setTemplates] = useState<AdminEmailTemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(true);
  const [showPreviewPanel, setShowPreviewPanel] = useState(true);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("Aluno AWS");
  const [targetMode, setTargetMode] = useState<"all-users" | "single-user">("all-users");
  const [userSearch, setUserSearch] = useState("");
  const [userOptions, setUserOptions] = useState<AdminUserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
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
      if (targetMode !== "single-user") {
        return;
      }

      try {
        const data = await listAdminUsers({
          page: 1,
          pageSize: 20,
          role: "user",
          active: "true",
          accessStatus: "approved",
          search: userSearch,
        });

        if (!cancelled) {
          setUserOptions(data.items);
        }
      } catch {
        if (!cancelled) {
          setUserOptions([]);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [targetMode, userSearch]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
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
    if (!selectedTemplate) {
      return;
    }

    if (!window.confirm("Deseja remover este template?")) {
      return;
    }

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
    if (!selectedTemplate) {
      setError("Selecione um template para enviar.");
      return;
    }

    if (targetMode === "single-user" && !selectedUserId) {
      setError("Selecione um usuario para envio individual.");
      return;
    }

    setSending(true);
    setMessage(null);
    setError(null);

    try {
      const result = await sendAdminEmailTemplate({
        templateId: selectedTemplate.id,
        targetMode,
        userId: targetMode === "single-user" ? selectedUserId : undefined,
      });

      setMessage(`Envio finalizado: ${result.sent} enviados, ${result.failed} falharam.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar template.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Admin Email</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gestao de templates e envio</h1>
        <p className="text-sm text-[#94a3b8]">
          Variaveis suportadas: {"{{name}}"}, {"{{app_url}}"}, {"{{logo_url}}"}.
        </p>
      </header>

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

              <div className="space-y-2 border border-[#334155] bg-[#0b1220] p-3">
                <p className="font-mono text-xs uppercase text-[#cbd5e1]">Enviar template</p>

                <div className="flex flex-wrap gap-3 text-xs uppercase">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={targetMode === "all-users"}
                      onChange={() => setTargetMode("all-users")}
                    />
                    Todos os usuarios aprovados
                  </label>

                  <label className="flex items-center gap-2">
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
                      className="w-full border border-[#334155] bg-[#111827] px-2 py-2 text-sm text-[#e2e8f0]"
                    />

                    <select
                      value={selectedUserId}
                      onChange={(event) => setSelectedUserId(event.target.value)}
                      className="w-full border border-[#334155] bg-[#111827] px-2 py-2 text-sm text-[#e2e8f0]"
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
                  disabled={sending || isCreatingNew}
                  className="border border-[#22c55e] px-3 py-2 text-xs uppercase text-[#86efac] disabled:opacity-40"
                >
                  {sending ? "Enviando..." : "Enviar template"}
                </button>

                {isCreatingNew && <p className="text-xs text-[#94a3b8]">Salve o template antes de enviar.</p>}
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
                <div className="max-h-[80vh] overflow-auto rounded border border-[#334155] bg-white p-2">
                  <div
                    className="min-h-[240px]"
                    dangerouslySetInnerHTML={{
                      __html: renderPreview(draft.html || "<p>Sem HTML para preview.</p>", previewName),
                    }}
                  />
                </div>
              </aside>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
