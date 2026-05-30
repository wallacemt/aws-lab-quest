"use client";

import Link from "next/link";
import { Github } from "lucide-react";

type Props = {
  authenticated: boolean;
};

export function CTASection({ authenticated }: Props) {
  return (
    <section
      className="landing-section relative overflow-hidden "
      style={{
        backgroundImage: "url('/landing/ruins-1.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 mx-auto max-w-2xl space-y-8 text-center">
        <div>
          <p
            className="mb-2 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--pixel-primary,#f97316)" }}
          >
            Sua certificacao AWS espera
          </p>
          <h2 className="font-mono text-2xl font-bold uppercase tracking-wide text-white md:text-4xl">
            Pronto para comecar?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Junte-se a quem ja esta estudando de forma inteligente.
            Crie sua conta gratuitamente e comece hoje.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          {authenticated ? (
            <Link
              href="/home"
              className="border-2 px-8 py-3 font-mono text-sm font-bold uppercase transition-all hover:opacity-90"
              style={{
                borderColor: "var(--pixel-primary,#f97316)",
                background: "var(--pixel-primary,#f97316)",
                color: "#000",
              }}
            >
              Continuar estudando
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="border-2 px-8 py-3 font-mono text-sm font-bold uppercase transition-all hover:opacity-90"
                style={{
                  borderColor: "var(--pixel-primary,#f97316)",
                  background: "var(--pixel-primary,#f97316)",
                  color: "#000",
                }}
              >
                Criar conta gratis
              </Link>
              <Link
                href="/login"
                className="border-2 border-white/40 px-8 py-3 font-mono text-sm uppercase text-white/80 hover:border-white transition-all"
              >
                Entrar
              </Link>
            </>
          )}
        </div>

        {/* Footer credits */}
        <div className="flex items-center justify-center gap-4 border-t border-white/10 pt-8">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-mono text-[10px] uppercase text-white/40 hover:text-white/70 transition-colors"
          >
            <Github size={14} />
            GitHub
          </a>
          <span className="text-white/20">·</span>
          <span className="font-mono text-[10px] text-white/40">
            AWS QUEST © 2025
          </span>
        </div>
      </div>
    </section>
  );
}
