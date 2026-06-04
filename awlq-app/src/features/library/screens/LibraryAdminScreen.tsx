"use client";

import { useCallback, useEffect, useState } from "react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── New Content Form ─────────────────────────────────────────────────────────

type NewContentFormProps = {
  onCreated: (item: LibraryContent) => void;
};

function NewContentForm({ onCreated }: NewContentFormProps) {
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
      // 1. Create the row
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

      // 2. Upload the file if provided (PDF / IMAGE / SLIDES)
      if (file && type !== "MARKDOWN") {
        const formData = new FormData();
        formData.append("file", file);
        await apiFetch<unknown>(`/api/admin/library/${created.content.id}/upload`, {
          method: "POST",
          body: formData,
        });
      }

      // Reset form
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

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4 rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] p-4"
    >
      <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--pixel-text)]">
        Novo Conteúdo
      </h2>

      {error && <p className="font-mono text-xs text-red-500">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Type */}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
            Tipo *
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LibraryContentType)}
            className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-2 py-1.5 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {/* Category */}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
            Categoria *
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-2 py-1.5 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Title */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
          Título *
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-2 py-1.5 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none"
        />
      </label>

      {/* Description */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
          Descrição
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-2 py-1.5 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none"
        />
      </label>

      {/* Author fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
            Autor *
          </span>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            required
            className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-2 py-1.5 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
            URL do Autor
          </span>
          <input
            type="url"
            value={authorUrl}
            onChange={(e) => setAuthorUrl(e.target.value)}
            placeholder="https://..."
            className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-2 py-1.5 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
            Contato
          </span>
          <input
            type="text"
            value={authorContact}
            onChange={(e) => setAuthorContact(e.target.value)}
            className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-2 py-1.5 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none"
          />
        </label>
      </div>

      {/* Markdown body — only shown for MARKDOWN type */}
      {type === "MARKDOWN" && (
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
            Conteúdo Markdown
          </span>
          <textarea
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            rows={10}
            className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-2 py-1.5 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none"
          />
        </label>
      )}

      {/* File upload — only shown for file-backed types */}
      {type !== "MARKDOWN" && (
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--pixel-muted)]">
            Arquivo (max 50 MB)
          </span>
          <input
            type="file"
            accept={type === "PDF" || type === "SLIDES" ? ".pdf" : "image/*"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-mono text-xs text-[var(--pixel-text)]"
          />
        </label>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded border border-[var(--pixel-accent)] bg-[var(--pixel-accent)] px-4 py-1.5 font-mono text-xs text-[var(--pixel-bg)] disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {isSubmitting ? "Criando..." : "Criar Conteúdo"}
      </button>
    </form>
  );
}

// ─── Content Row ──────────────────────────────────────────────────────────────

type ContentRowProps = {
  item: LibraryContent;
  onTogglePublish: (item: LibraryContent) => void;
  onDelete: (item: LibraryContent) => void;
};

function ContentRow({ item, onTogglePublish, onDelete }: ContentRowProps) {
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleTogglePublish = async () => {
    setIsTogglingPublish(true);
    try {
      await apiFetch<unknown>(`/api/admin/library/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !item.published }),
      });
      onTogglePublish({ ...item, published: !item.published });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar.");
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Deletar "${item.title}"? Esta ação não pode ser desfeita.`)) return;
    setIsDeleting(true);
    try {
      await apiFetch<unknown>(`/api/admin/library/${item.id}`, { method: "DELETE" });
      onDelete(item);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao deletar.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-bold text-[var(--pixel-text)] truncate">{item.title}</p>
        <p className="font-mono text-[10px] text-[var(--pixel-muted)]">
          {item.type} · {item.category} · por {item.authorName}
        </p>
      </div>

      <span
        className={`flex-shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
          item.published
            ? "bg-green-900/40 text-green-400"
            : "bg-[var(--pixel-border)] text-[var(--pixel-muted)]"
        }`}
      >
        {item.published ? "Publicado" : "Rascunho"}
      </span>

      <button
        onClick={() => void handleTogglePublish()}
        disabled={isTogglingPublish}
        className="flex-shrink-0 font-mono text-[10px] text-[var(--pixel-accent)] underline hover:opacity-70 disabled:opacity-40"
      >
        {item.published ? "Despublicar" : "Publicar"}
      </button>

      <button
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        className="flex-shrink-0 font-mono text-[10px] text-red-400 underline hover:opacity-70 disabled:opacity-40"
      >
        Deletar
      </button>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function LibraryAdminScreen() {
  const [items, setItems] = useState<LibraryContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    void load();
  }, [load]);

  const handleCreated = useCallback((item: LibraryContent) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  const handleTogglePublish = useCallback((updated: LibraryContent) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);

  const handleDelete = useCallback((deleted: LibraryContent) => {
    setItems((prev) => prev.filter((i) => i.id !== deleted.id));
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <h1 className="font-mono text-sm uppercase tracking-wide text-[var(--pixel-text)]">
        Admin · Biblioteca
      </h1>

      <NewContentForm onCreated={handleCreated} />

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--pixel-muted)]">
          Conteúdo ({items.length})
        </h2>

        {isLoading && (
          <p className="font-mono text-xs text-[var(--pixel-muted)]">Carregando...</p>
        )}

        {loadError && (
          <p className="font-mono text-xs text-red-500">{loadError}</p>
        )}

        {!isLoading && !loadError && items.length === 0 && (
          <p className="font-mono text-xs text-[var(--pixel-muted)]">
            Nenhum conteúdo cadastrado.
          </p>
        )}

        {items.map((item) => (
          <ContentRow
            key={item.id}
            item={item}
            onTogglePublish={handleTogglePublish}
            onDelete={handleDelete}
          />
        ))}
      </section>
    </div>
  );
}
