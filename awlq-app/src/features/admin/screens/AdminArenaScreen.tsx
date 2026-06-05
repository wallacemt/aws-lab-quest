"use client";

import { useCallback, useEffect, useState } from "react";

type Boss = {
  id: string;
  name: string;
  code: string;
  themeService: string;
  maxHp: number;
  damagePerCorrect: number;
  artworkUrl: string | null;
  active: boolean;
};

type EditState = Partial<Pick<Boss, "name" | "code" | "themeService" | "maxHp" | "damagePerCorrect" | "artworkUrl" | "active">>;

const EMPTY_FORM = {
  name: "",
  code: "",
  themeService: "",
  maxHp: "1000",
  damagePerCorrect: "10",
  artworkUrl: "",
  active: true,
};

const PAGE_SIZE = 10;

const FIELD_LABELS: [keyof typeof EMPTY_FORM, string][] = [
  ["name", "Nome"],
  ["code", "Código único"],
  ["themeService", "Serviço AWS (code)"],
  ["maxHp", "HP máximo"],
  ["damagePerCorrect", "Dano por resposta certa"],
  ["artworkUrl", "URL da arte (opcional)"],
];

export function AdminArenaScreen() {
  const [bosses, setBosses] = useState<Boss[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({});
  const [page, setPage] = useState(1);

  const loadBosses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/arena/bosses", { credentials: "include" });
      const data = (await res.json()) as { bosses?: Boss[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar bosses");
      setBosses(data.bosses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar bosses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBosses();
  }, [loadBosses]);

  async function handleCreate() {
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/arena/bosses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          themeService: form.themeService,
          maxHp: parseInt(form.maxHp, 10),
          damagePerCorrect: parseInt(form.damagePerCorrect, 10),
          artworkUrl: form.artworkUrl || null,
          active: form.active,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar boss");
      setForm(EMPTY_FORM);
      setMessage("Boss criado com sucesso.");
      void loadBosses();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar boss.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(boss: Boss) {
    await fetch(`/api/admin/arena/bosses/${boss.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: !boss.active }),
    });
    void loadBosses();
  }

  async function handleSaveEdit(boss: Boss) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/arena/bosses/${boss.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editState.name ?? boss.name,
          code: editState.code ?? boss.code,
          themeService: editState.themeService ?? boss.themeService,
          maxHp: editState.maxHp ?? boss.maxHp,
          damagePerCorrect: editState.damagePerCorrect ?? boss.damagePerCorrect,
          artworkUrl: editState.artworkUrl !== undefined ? (editState.artworkUrl || null) : boss.artworkUrl,
          active: editState.active !== undefined ? editState.active : boss.active,
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      setEditingId(null);
      setEditState({});
      setMessage("Boss atualizado.");
      void loadBosses();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bossId: string) {
    if (!confirm("Remover boss? Esta ação não pode ser desfeita.")) return;
    await fetch(`/api/admin/arena/bosses/${bossId}`, {
      method: "DELETE",
      credentials: "include",
    });
    void loadBosses();
  }

  const totalPages = Math.max(1, Math.ceil(bosses.length / PAGE_SIZE));
  const paginated = bosses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Arena</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gerenciar Bosses</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadBosses()}
            disabled={loading}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0] disabled:opacity-50"
          >
            Atualizar
          </button>
          {bosses.length > 0 && (
            <span className="font-mono text-xs text-[#64748b]">{bosses.length} boss(es) cadastrados</span>
          )}
        </div>
      </header>

      {message && <p className="font-mono text-xs text-[#86efac]">{message}</p>}
      {error && <p className="font-mono text-xs text-[#fca5a5]">{error}</p>}

      {/* Create form */}
      <section className="border border-[#1e293b] bg-[#111827] p-4 space-y-4">
        <p className="font-mono text-xs uppercase text-[#94a3b8]">Novo Boss</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FIELD_LABELS.map(([field, label]) => (
            <div key={field}>
              <label className="block font-mono text-[10px] uppercase text-[#94a3b8] mb-1">{label}</label>
              <input
                className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
                value={form[field] as string}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="new-boss-active"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
              className="accent-[#f97316]"
            />
            <label htmlFor="new-boss-active" className="font-mono text-xs text-[#94a3b8]">Ativo</label>
          </div>
        </div>
        {createError && <p className="font-mono text-xs text-[#fca5a5]">{createError}</p>}
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={saving || !form.name || !form.code}
          className="border border-[#f97316] px-4 py-2 font-mono text-xs uppercase text-[#f97316] disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Criar Boss"}
        </button>
      </section>

      {/* List */}
      {loading ? (
        <p className="font-mono text-xs text-[#94a3b8]">Carregando bosses...</p>
      ) : (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Nome / Código</th>
                  <th className="px-3 py-2">Serviço AWS</th>
                  <th className="px-3 py-2 text-center">Max HP</th>
                  <th className="px-3 py-2 text-center">Dano/certa</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((boss) => (
                  <tr key={boss.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                    {editingId === boss.id ? (
                      <>
                        <td className="px-3 py-2" colSpan={4}>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {(["name", "code", "themeService", "artworkUrl"] as const).map((f) => (
                              <input
                                key={f}
                                placeholder={f}
                                className="border border-[#334155] bg-[#0b1220] px-2 py-1.5 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
                                value={(editState[f] as string | undefined) ?? (boss[f] as string | null | undefined) ?? ""}
                                onChange={(e) => setEditState((p) => ({ ...p, [f]: e.target.value }))}
                              />
                            ))}
                            {(["maxHp", "damagePerCorrect"] as const).map((f) => (
                              <input
                                key={f}
                                type="number"
                                placeholder={f}
                                className="border border-[#334155] bg-[#0b1220] px-2 py-1.5 font-mono text-xs text-[#e2e8f0] focus:border-[#f97316] focus:outline-none"
                                value={(editState[f] as number | undefined) ?? boss[f]}
                                onChange={(e) => setEditState((p) => ({ ...p, [f]: parseInt(e.target.value, 10) }))}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={(editState.active as boolean | undefined) ?? boss.active}
                            onChange={(e) => setEditState((p) => ({ ...p, active: e.target.checked }))}
                            className="accent-[#f97316]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEdit(boss)}
                              disabled={saving}
                              className="border border-[#22c55e] px-3 py-1 font-mono text-[10px] uppercase text-[#22c55e] disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingId(null); setEditState({}); }}
                              className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">
                          <p className="text-sm">{boss.name}</p>
                          <p className="text-xs text-[#64748b]">{boss.code}</p>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#94a3b8]">{boss.themeService}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs">{boss.maxHp}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs">{boss.damagePerCorrect}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(boss)}
                            className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${
                              boss.active
                                ? "border-[#14532d] bg-green-900/20 text-green-300"
                                : "border-[#334155] text-[#64748b]"
                            }`}
                          >
                            {boss.active ? "Ativo" : "Inativo"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setEditingId(boss.id); setEditState({}); }}
                              className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(boss.id)}
                              className="border border-red-500/40 px-3 py-1 font-mono text-[10px] uppercase text-red-400"
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                      Nenhum boss cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {totalPages > 1 && (
            <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
              <span className="font-mono text-xs">
                Página {page} de {totalPages} | Total: {bosses.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </main>
  );
}
