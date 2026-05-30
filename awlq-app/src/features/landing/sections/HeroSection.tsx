"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  authenticated: boolean;
};

function useCountUp(target: number, duration = 1800, delay = 400) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let raf: number;
    const timer = setTimeout(() => {
      let startTime: number | null = null;
      function tick(ts: number) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));
        if (progress < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);

  return count;
}

export function HeroSection({ authenticated }: Props) {
  const questoes = useCountUp(1000, 1800, 400);
  const modos = useCountUp(6, 1200, 600);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/online/count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.onlineCount != null) setOnlineCount(data.onlineCount);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="hero-bg scanlines">
      {/* Blurred background image */}
      <div className="hero-bg-image" style={{ backgroundImage: "url('/landing/cityscape-1.png')" }} />

      <div className="hero-content flex min-h-screen flex-col items-center justify-center px-4 text-center">
        {/* Cloud floating wrapper */}
        <div className="hero-cloud-wrapper">
          {/* Smoke puffs */}
          <div className="smoke-puff smoke-1" />
          <div className="smoke-puff smoke-2" />
          <div className="smoke-puff smoke-3" />
          <div className="smoke-puff smoke-4" />
          <div className="smoke-puff smoke-5" />
          <div className="smoke-puff smoke-6" />
          <div className="smoke-puff smoke-7" />

          {/* Cloud card */}
          <div className="hero-cloud">
            {/* Online badge */}
            {onlineCount != null && onlineCount > 1 && (
              <div className="mb-5 flex items-center justify-center gap-2">
                <div className="online-dot" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-green-400">
                  {onlineCount} estudantes online agora
                </span>
              </div>
            )}

            {/* Badge */}
            <div
              className="mb-6 inline-flex items-center gap-2 border px-3 py-1.5"
              style={{ borderColor: "var(--pixel-primary,#f97316)", color: "var(--pixel-primary,#f97316)" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-widest">Plataforma de Estudos AWS</span>
            </div>

            {/* Title */}
            <h1
              className="mb-4 font-mono text-4xl font-bold uppercase leading-tight tracking-wider md:text-6xl "
              style={{ color: "var(--pixel-primary,#f97316)" }}
            >
              AWS QUEST
            </h1>

            {/* Subtitle */}
            <p className="mb-8 max-w-xl text-base leading-relaxed text-white/80 md:text-lg pixel-cursor">
              Estude para certificacoes AWS de forma gamificada. XP real. Skills reais. Evolucao constante.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {authenticated ? (
                <>
                  <Link
                    href="/home"
                    className="border-2 px-6 py-3 font-mono text-sm uppercase font-bold transition-all hover:opacity-90"
                    style={{
                      borderColor: "var(--pixel-primary,#f97316)",
                      background: "var(--pixel-primary,#f97316)",
                      color: "#000",
                    }}
                  >
                    Ir para o App
                  </Link>
                  <Link
                    href="/profile"
                    className="border-2 border-white/40 px-6 py-3 font-mono text-sm uppercase text-white/80 hover:border-white transition-all"
                  >
                    Meu Perfil
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="border-2 px-6 py-3 font-mono text-sm uppercase font-bold transition-all hover:opacity-90"
                    style={{
                      borderColor: "var(--pixel-primary,#f97316)",
                      background: "var(--pixel-primary,#f97316)",
                      color: "#000",
                    }}
                  >
                    Entrar na Quest
                  </Link>
                  <Link
                    href="/login"
                    className="border-2 border-white/40 px-6 py-3 font-mono text-sm uppercase text-white/80 hover:border-white transition-all"
                  >
                    Ja tenho conta
                  </Link>
                </>
              )}
            </div>

            {/* Stats row */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-8 border-t border-white/10 pt-8">
              <div className="flex flex-col items-center">
                <span
                  className="font-mono text-2xl font-bold tabular-nums"
                  style={{ color: "var(--pixel-primary,#f97316)" }}
                >
                  {questoes.toLocaleString()}+
                </span>
                <span className="font-mono text-[10px] uppercase text-white/60">Questoes</span>
              </div>
              <div className="flex flex-col items-center">
                <span
                  className="font-mono text-2xl font-bold tabular-nums"
                  style={{ color: "var(--pixel-primary,#f97316)" }}
                >
                  {modos}
                </span>
                <span className="font-mono text-[10px] uppercase text-white/60">Modos</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5">
                  <div className="online-dot" style={{ width: 7, height: 7 }} />
                  <span className="font-mono text-2xl font-bold" style={{ color: "var(--pixel-primary,#f97316)" }}>
                    Live
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase text-white/60">Leaderboard</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ChevronDown className="bounce-arrow text-white/40" size={28} />
        </div>
      </div>
    </section>
  );
}
