"use client";

interface PdfViewerProps {
  url: string;
}

// ponytail: native <iframe> over react-pdf — browsers already render PDFs,
// zero worker config, zero dependency. Loses in-app page nav; add react-pdf
// back only if we need custom controls the browser's built-in viewer can't do.
export function PdfViewer({ url }: PdfViewerProps) {
  return (
    <iframe
      src={url}
      title="Visualizador de PDF"
      className="w-full border border-[var(--pixel-border)]"
      style={{ height: "80vh", minHeight: 400 }}
    />
  );
}
