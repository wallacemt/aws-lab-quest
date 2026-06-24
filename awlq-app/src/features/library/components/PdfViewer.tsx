"use client";

import { useCallback, useState } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker. Must live in the same module that renders
// <Document> / <Page>. Uses import.meta.url so bundlers can resolve the
// correct path without hard-coding a CDN URL.


interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setCurrentPage(1);
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(`Falha ao carregar o PDF: ${err.message}`);
    setIsLoading(false);
  }, []);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Navigation controls */}
      {totalPages > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="font-mono text-xs px-3 py-1 border border-[var(--pixel-border)] text-[var(--pixel-text)] disabled:opacity-40 hover:bg-[var(--pixel-border)] transition-colors"
            aria-label="Página anterior"
          >
            ← Anterior
          </button>

          <span className="font-mono text-xs text-[var(--pixel-muted)]">
            Página {currentPage} de {totalPages}
          </span>

          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            className="font-mono text-xs px-3 py-1 border border-[var(--pixel-border)] text-[var(--pixel-text)] disabled:opacity-40 hover:bg-[var(--pixel-border)] transition-colors"
            aria-label="Próxima página"
          >
            Próxima →
          </button>
        </div>
      )}

      {/* PDF Document */}
      <div className="w-full overflow-auto">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex justify-center py-12">
              <p className="font-mono text-xs text-[var(--pixel-muted)]">Carregando PDF...</p>
            </div>
          }
          error={
            <div className="flex justify-center py-12">
              <p className="font-mono text-xs text-red-500">
                {error ?? "Não foi possível carregar o PDF."}
              </p>
            </div>
          }
        >
          {!isLoading && !error && (
            <Page
              pageNumber={currentPage}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="mx-auto shadow-md"
            />
          )}
        </Document>
      </div>
    </div>
  );
}
