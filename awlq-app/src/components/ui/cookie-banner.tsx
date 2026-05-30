"use client";

import { useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "cookieConsent";

export function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(CONSENT_KEY);
  });

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-4 py-4 shadow-[0_-4px_0_0_var(--pixel-shadow)] md:flex md:items-center md:justify-between"
    >
      <p className="mb-3 font-sans text-sm text-[var(--pixel-text)] md:mb-0 md:mr-6">
        Este site usa cookies essenciais de sessao para autenticacao e funcionamento da plataforma. Nenhum cookie de
        rastreamento ou publicidade e utilizado.{" "}
        <Link href="/privacidade" className="font-semibold text-[var(--pixel-primary)] underline">
          Saiba mais
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={handleAccept}
        className="shrink-0 border-2 border-[var(--pixel-border)] bg-[var(--pixel-primary)] px-4 py-2 font-mono text-xs uppercase text-[var(--pixel-bg)] hover:opacity-90"
      >
        Entendido
      </button>
    </div>
  );
}
