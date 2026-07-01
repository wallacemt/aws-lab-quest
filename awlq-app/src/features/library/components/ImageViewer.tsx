"use client";

import { useEffect, useRef, useState } from "react";

interface ImageViewerProps {
  src: string;
  alt: string;
}

export function ImageViewer({ src, alt }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement === containerRef.current) {
      void document.exitFullscreen();
    } else if (!document.fullscreenElement) {
      void containerRef.current?.requestFullscreen();
    }
  }

  function clampScale(s: number) {
    return Math.min(4, Math.max(0.5, s));
  }

  function reset() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => clampScale(s - e.deltaY * 0.001));
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  }

  function handlePointerUp() {
    dragStart.current = null;
    setIsDragging(false);
  }

  function handleDoubleClick() {
    reset();
  }

  const transform = `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`;

  return (
    <div className="relative flex flex-col gap-2">
      {/* Controls overlay */}
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono text-[10px] text-[var(--pixel-accent)]">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((s) => clampScale(s - 0.25))}
          className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-0.5 font-mono text-xs text-[var(--pixel-text)] hover:border-[var(--pixel-accent)] transition-colors"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => clampScale(s + 0.25))}
          className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-0.5 font-mono text-xs text-[var(--pixel-text)] hover:border-[var(--pixel-accent)] transition-colors"
        >
          +
        </button>
        <button
          type="button"
          onClick={reset}
          title="Resetar zoom e posição"
          className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-0.5 font-mono text-[10px] text-[var(--pixel-text)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)] transition-colors"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          className="border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-0.5 font-mono text-[10px] text-[var(--pixel-text)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)] transition-colors"
        >
          {isFullscreen ? "⛶ Sair" : "⛶ Tela Cheia"}
        </button>
      </div>

      {/* Viewer container */}
      <div
        ref={containerRef}
        className="overflow-hidden border border-[var(--pixel-border)] bg-[var(--pixel-border)]/10"
        style={{
          minHeight: "300px",
          maxHeight: isFullscreen ? "100vh" : "70vh",
          height: isFullscreen ? "100vh" : undefined,
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="flex items-center justify-center w-full h-full"
          style={{ minHeight: "300px" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{
              transform,
              transition: isDragging ? "none" : "transform 0.15s ease",
              maxWidth: "100%",
              maxHeight: isFullscreen ? "100vh" : "70vh",
              display: "block",
            }}
          />
        </div>
      </div>

      <p className="font-mono text-[10px] text-[var(--pixel-muted)] text-center">
        Scroll para zoom · Arraste para mover · Duplo clique para resetar
      </p>
    </div>
  );
}
