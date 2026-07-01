"use client";

import { useEffect, useRef, useState } from "react";

interface PdfViewerProps {
  url: string;
}

// ponytail: native <iframe> over react-pdf — browsers already render PDFs,
// zero worker config, zero dependency. Loses in-app page nav; add react-pdf
// back only if we need custom controls the browser's built-in viewer can't do.
export function PdfViewer({ url }: PdfViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-0.5 font-mono text-[10px] text-[var(--pixel-text)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)] transition-colors"
        >
          {isFullscreen ? "⛶ Sair" : "⛶ Tela Cheia"}
        </button>
      </div>
      <div ref={containerRef} className="flex flex-col" style={{ background: "var(--pixel-bg)" }}>
        <iframe
          src={url}
          title="Visualizador de PDF"
          className="w-full border border-[var(--pixel-border)]"
          style={{ height: isFullscreen ? "100vh" : "80vh", minHeight: 400 }}
        />
      </div>
    </div>
  );
}
