"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AuthorCredit } from "@/features/library/components/AuthorCredit";
import { MarkdownViewer } from "@/features/library/components/MarkdownViewer";
import type { LibraryContentWithUrl } from "@/features/library/types";

// PdfViewer is loaded lazily with SSR disabled:
//   1. react-pdf/pdfjs runs in the browser only (Canvas API, Web Workers).
//   2. PDF.js worker setup uses import.meta.url, which is not resolvable on the server.
const PdfViewer = dynamic(
  () => import("@/features/library/components/PdfViewer").then((m) => m.PdfViewer),
  { ssr: false, loading: () => <p className="font-mono text-xs text-[var(--pixel-muted)]">Carregando visualizador...</p> },
);

interface LibraryItemScreenProps {
  content: LibraryContentWithUrl;
}

export function LibraryItemScreen({ content }: LibraryItemScreenProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      {/* Back nav */}
      <Link
        href="/biblioteca"
        className="font-mono text-xs text-[var(--pixel-muted)] hover:text-[var(--pixel-accent)] transition-colors"
      >
        ← Voltar à Biblioteca
      </Link>

      {/* Title */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--pixel-muted)]">
          {content.category}
        </p>
        <h1 className="mt-1 font-mono text-base font-bold text-[var(--pixel-text)]">
          {content.title}
        </h1>
        {content.description && (
          <p className="mt-1 font-mono text-xs text-[var(--pixel-muted)]">{content.description}</p>
        )}
      </div>

      {/* Author credit — RF-13 requires this to be prominent */}
      <AuthorCredit
        authorName={content.authorName}
        authorUrl={content.authorUrl}
        authorContact={content.authorContact}
      />

      {/* Content renderer */}
      <div className="rounded border border-[var(--pixel-border)] bg-[var(--pixel-surface)] p-4">
        {content.type === "PDF" || content.type === "SLIDES" ? (
          content.signedUrl ? (
            <PdfViewer url={content.signedUrl} />
          ) : (
            <p className="font-mono text-xs text-red-500">
              URL do arquivo não disponível. Tente novamente mais tarde.
            </p>
          )
        ) : content.type === "IMAGE" ? (
          content.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.signedUrl}
              alt={content.title}
              className="mx-auto max-w-full rounded"
            />
          ) : (
            <p className="font-mono text-xs text-red-500">
              Imagem não disponível. Tente novamente mais tarde.
            </p>
          )
        ) : content.type === "MARKDOWN" ? (
          content.bodyMarkdown ? (
            <MarkdownViewer content={content.bodyMarkdown} />
          ) : (
            <p className="font-mono text-xs text-[var(--pixel-muted)]">
              Nenhum conteúdo disponível.
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}
