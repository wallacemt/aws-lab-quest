"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AuthorCredit } from "@/features/library/components/AuthorCredit";
import { MarkdownViewer } from "@/features/library/components/MarkdownViewer";
import type { LibraryContentWithUrl } from "@/features/library/types";

// PdfViewer and ImageViewer are loaded lazily with SSR disabled (browser-only APIs).
const PdfViewer = dynamic(
  () => import("@/features/library/components/PdfViewer").then((m) => m.PdfViewer),
  { ssr: false, loading: () => <p className="font-mono text-xs text-[var(--pixel-muted)]">Carregando visualizador...</p> },
);

const ImageViewer = dynamic(
  () => import("@/features/library/components/ImageViewer").then((m) => m.ImageViewer),
  { ssr: false, loading: () => <p className="font-mono text-xs text-[var(--pixel-muted)]">Carregando imagem...</p> },
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
        className="font-mono text-xs text-[var(--pixel-text)] hover:text-[var(--pixel-accent)] transition-colors"
      >
        ← Voltar à Biblioteca
      </Link>

      {/* Title */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--pixel-subtext)]">
          {content.category}
        </p>
        <h1 className="mt-1 font-mono text-base font-bold text-[var(--pixel-text)]">
          {content.title}
        </h1>
        {content.description && (
          <p className="mt-1 font-mono text-xs text-[var(--pixel-subtext)]">{content.description}</p>
        )}
      </div>

      {/* Author credit — RF-13 requires this to be prominent */}
      <AuthorCredit
        authorName={content.authorName}
        authorUrl={content.authorUrl}
        authorContact={content.authorContact}
      />

      {/* Content renderer */}
      <div className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] p-4">
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
            <ImageViewer src={content.signedUrl} alt={content.title} />
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
