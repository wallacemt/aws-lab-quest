"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await authClient.signIn.email({ email, password });

    if (authError) {
      setError(authError.message ?? "Credenciais inválidas. Verifique e-mail e senha.");
      setLoading(false);
      return;
    }

    // Clear legacy localStorage data to avoid conflicts with DB-backed state
    if (typeof window !== "undefined") {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("awlq_") && k !== "awlq_activeQuest" && k !== "awlq_font_scale")
        .forEach((k) => localStorage.removeItem(k));
    }

    router.replace("/");
  }

  return (
    <div className="relative min-h-screen bg-[var(--pixel-bg)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-[var(--font-pixel)] text-xl text-[var(--pixel-primary)] drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
            AWS LAB QUEST
          </h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Entre para começar sua jornada na nuvem
          </p>
        </div>

        <PixelCard className="w-full max-w-md space-y-5">
          <h2 className="text-center font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">Login</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block font-[var(--font-body)] text-sm font-semibold">
              E-mail
              <input
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block font-[var(--font-body)] text-sm font-semibold">
              Senha
              <input
                type="password"
                required
                autoComplete="current-password"
                className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && (
              <PixelCard className="border-red-500 bg-red-900/30 py-2">
                <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
              </PixelCard>
            )}

            <PixelButton type="submit" disabled={loading} className="w-full">
              {loading ? "Entrando..." : "Entrar no Jogo"}
            </PixelButton>
          </form>

          <p className="text-center font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Não tem conta?{" "}
            <Link href="/register" className="font-semibold text-[var(--pixel-primary)] underline">
              Criar conta
            </Link>
          </p>
        </PixelCard>
      </div>
    </div>
  );
}
