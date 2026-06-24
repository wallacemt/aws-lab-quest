"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LibraryContent, LibraryContentType } from "@prisma/client";

const CONTENT_TYPES: LibraryContentType[] = ["PDF", "IMAGE", "MARKDOWN", "SLIDES"];
const CATEGORIES = [
  "Practitioner",
  "SAA",
  "Developer",
  "SysOps",
  "Security",
  "Networking",
  "Database",
  "Serverless",
];
const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Create Form ──────────────────────────────────────────────────────────────

type CreateFormProps = {
  onCreated: (item: LibraryContent) => void;
};

function CreateForm({ onCreated }: CreateFormProps) {
  const [type, setType] = useState<LibraryContentType>("MARKDOWN");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [authorName, setAuthorName] = useState("");
  const [authorUrl, setAuthorUrl] = useState("");
  const [authorContact, setAuthorContact] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await apiFetch<{ content: LibraryContent }>("/api/admin/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          authorName: authorName.trim(),
          authorUrl: authorUrl.trim() || undefined,
          authorContact: authorContact.trim() || undefined,
          bodyMarkdown: type === "MARKDOWN" ? bodyMarkdown : undefined,
        }),
      });

      if (file && type !== "MARKDOWN") {
        const formData = new FormData();
        formData.append("file", file);
        await apiFetch<unknown>(`/api/admin/library/${created.content.id}/upload`, {
          method: "POST",
          body: formData,
        });
      }

      setTitle("");
      setDescription("");
      setAuthorName("");
      setAuthorUrl("");
      setAuthorContact("");
      setBodyMarkdown("");
      setFile(null);
      onCreated(created.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conteúdo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none focus:border-[#f97316]";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {error && <p className="font-mono text-xs text-red-500">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Tipo *</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LibraryContentType)}
            className={inputClass}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Categoria *</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase text-[#64748b]">Título *</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase text-[#64748b]">Descrição</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Autor *</span>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">URL do Autor</span>
          <input
            type="url"
            value={authorUrl}
            onChange={(e) => setAuthorUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Contato</span>
          <input
            type="text"
            value={authorContact}
            onChange={(e) => setAuthorContact(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {type === "MARKDOWN" && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Conteúdo Markdown</span>
          <textarea
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            rows={10}
            className={inputClass}
          />
        </div>
      )}

      {type !== "MARKDOWN" && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-[#64748b]">Arquivo (max 50 MB)</span>
          <input
            type="file"
            accept={type === "PDF" || type === "SLIDES" ? ".pdf" : "image/*"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-mono text-xs text-[#e2e8f0]"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="border border-[#f97316] bg-[#f97316] px-4 py-2 font-mono text-xs uppercase text-[#0b1220] disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {isSubmitting ? "Criando..." : "Criar Conteúdo"}
      </button>
    </form>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function LibraryAdminScreen() {
  const [items, setItems] = useState<LibraryContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchTitle, setSearchTitle] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<{ content: LibraryContent[] }>("/api/admin/library");
      setItems(data.content);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleCreated = useCallback((item: LibraryContent) => {
    setItems((prev) => [item, ...prev]);
    setPage(1);
  }, []);

  // Client-side filtering
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (searchTitle && !item.title.toLowerCase().includes(searchTitle.toLowerCase())) return false;
      if (filterType && item.type !== filterType) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterStatus === "published" && !item.published) return false;
      if (filterStatus === "draft" && item.published) return false;
      return true;
    });
  }, [items, searchTitle, filterType, filterCategory, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function handleTogglePublish(item: LibraryContent) {
    try {
      await apiFetch<unknown>(`/api/admin/library/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !item.published }),
      });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, published: !i.published } : i)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar.");
    }
  }

  async function handleDelete(item: LibraryContent) {
    if (!confirm(`Deletar "${item.title}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await apiFetch<unknown>(`/api/admin/library/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao deletar.");
    }
  }

  const inputClass =
    "w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none";

  return (
    <main className="space-y-5">
      {/* Header */}
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Biblioteca</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gerenciar Conteúdo</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadItems()}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0]"
          >
            Atualizar dados
          </button>
          <span className="font-mono text-xs text-[#64748b]">
            {items.length} item(s)
          </span>
        </div>
      </header>

      {/* Filters */}
      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={searchTitle}
            onChange={(e) => { setPage(1); setSearchTitle(e.target.value); }}
            placeholder="Buscar por título"
            className={inputClass}
          />
          <select
            value={filterType}
            onChange={(e) => { setPage(1); setFilterType(e.target.value); }}
            className={inputClass}
          >
            <option value="">Todos os tipos</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => { setPage(1); setFilterCategory(e.target.value); }}
            className={inputClass}
          >
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setPage(1); setFilterStatus(e.target.value); }}
            className={inputClass}
          >
            <option value="">Todos os status</option>
            <option value="published">Publicado</option>
            <option value="draft">Rascunho</option>
          </select>
        </div>
      </section>

      {/* Create form */}
      <section className="border border-[#1e293b] bg-[#111827] p-4 space-y-4">
        <p className="font-mono text-xs uppercase text-[#f97316]">Novo Conteúdo</p>
        <CreateForm onCreated={handleCreated} />
      </section>

      {isLoading && <p className="text-sm text-[#94a3b8]">Carregando conteúdo...</p>}
      {loadError && <p className="text-sm text-[#fca5a5]">{loadError}</p>}

      {/* Table */}
      {!isLoading && !loadError && (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Título / Autor</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center font-mono text-xs text-[#64748b]">
                      Nenhum conteúdo encontrado.
                    </td>
                  </tr>
                )}
                {pageItems.map((item) => (
                  <tr key={item.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <p className="font-mono text-xs font-semibold">{item.title}</p>
                      <p className="font-mono text-[10px] text-[#64748b]">por {item.authorName}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="border border-[#334155] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#94a3b8]">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#94a3b8]">{item.category}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                          item.published
                            ? "border-[#14532d] bg-green-900/20 text-green-300"
                            : "border-[#334155] text-[#64748b]"
                        }`}
                      >
                        {item.published ? "Publicado" : "Rascunho"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleTogglePublish(item)}
                          className="border border-[#334155] px-2 py-1 font-mono text-[10px] uppercase text-[#94a3b8] hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                        >
                          {item.published ? "Despublicar" : "Publicar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          className="border border-[#334155] px-2 py-1 font-mono text-[10px] uppercase text-red-400 hover:border-red-600 transition-colors"
                        >
                          Deletar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
            <span>
              Página {safePage} de {totalPages} | Total: {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
