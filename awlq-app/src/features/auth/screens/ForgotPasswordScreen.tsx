"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function getResetRedirectUrl() {
  if (typeof window === "undefined") {
    return "/reset-password";
  }

  return `${window.location.origin}/reset-password`;
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          redirectTo: getResetRedirectUrl(),
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Nao foi possivel enviar o link de redefinicao.");
      }

      setMessage( "Se o e-mail existir, voce recebera um link para redefinir a senha.");
      setEmail("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao solicitar redefinicao de senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--pixel-bg)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <Image
              src="/icon.png"
              alt="AWS Quest logo"
              width={300}
              height={300}
              priority
              className="h-auto w-40 rounded-2xl retro-shadow md:w-52"
            />
          </div>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Informe seu e-mail para receber o link de redefinicao.
          </p>
        </div>

        <PixelCard className="w-full max-w-md space-y-5">
          <h2 className="text-center font-mono text-xs uppercase text-[var(--pixel-primary)]">Esqueci minha senha</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block font-[var(--font-body)] text-sm">
              E-mail
              <input
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            {error && (
              <PixelCard className="border-red-500 bg-red-900/30 py-2">
                <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
              </PixelCard>
            )}

            {message && (
              <PixelCard className="border-green-500 bg-green-900/30 py-2">
                <p className="font-[var(--font-body)] text-sm text-green-300">{message}</p>
              </PixelCard>
            )}

            <PixelButton type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando..." : "Enviar link de redefinicao"}
            </PixelButton>
          </form>

          <p className="text-center font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Lembrou a senha?{" "}
            <Link href="/login" className="font-semibold text-[var(--pixel-primary)] underline">
              Voltar para login
            </Link>
          </p>
        </PixelCard>
      </div>
    </div>
  );
}
