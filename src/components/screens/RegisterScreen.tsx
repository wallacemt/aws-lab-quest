"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { authClient } from "@/lib/auth-client";
import { setOnboardingStep } from "@/lib/onboarding";
import { ThemeToggle } from "@/components/ThemeToggle";
import appLogo from "@/assets/logo.png";

export function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function normalizeUsername(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  function isValidUsername(value: string) {
    return /^[a-z0-9_]{3,24}$/.test(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedUsername = normalizeUsername(username);

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (normalizedUsername && !isValidUsername(normalizedUsername)) {
      setError("Nome de usuario invalido. Use 3-24 caracteres com letras, numeros ou _.");
      return;
    }

    if (normalizedUsername) {
      const availability = await fetch(`/api/user/username?value=${encodeURIComponent(normalizedUsername)}`);
      const availabilityData = (await availability.json()) as { available?: boolean; error?: string };
      if (!availabilityData.available) {
        setError(availabilityData.error ?? "Nome de usuario indisponivel.");
        return;
      }
    }

    setLoading(true);

    const { error: authError } = await authClient.signUp.email({ name, email, password });

    if (authError) {
      setError(authError.message ?? "Erro ao criar conta. Tente novamente.");
      setLoading(false);
      return;
    }

    const usernameResponse = await fetch("/api/user/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedUsername ? { username: normalizedUsername } : { random: true }),
    });

    if (!usernameResponse.ok) {
      const usernameData = (await usernameResponse.json()) as { error?: string };
      setError(usernameData.error ?? "Conta criada, mas falhou ao definir username. Edite no perfil.");
    }

    setOnboardingStep("manual");
    router.replace("/help");
  }

  return (
    <div className="relative min-h-screen bg-[var(--pixel-bg)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <Image
              src={appLogo}
              alt="AWS Lab Quest logo"
              width={124}
              height={124}
              priority
              className="h-auto w-28 sm:w-32"
            />
          </div>
          <h1 className="font-[var(--font-pixel)] text-xl text-[var(--pixel-primary)] drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
            AWS LAB QUEST
          </h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Crie sua conta e entre na jornada
          </p>
        </div>

        <PixelCard className="w-full max-w-md space-y-5">
          <h2 className="text-center font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">
            Criar Conta
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block font-[var(--font-body)] text-sm">
              Nome de jogador
              <input
                type="text"
                required
                autoComplete="name"
                className="mt-1 w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="block font-[var(--font-body)] text-sm">
              Nome de usuario unico
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  autoComplete="username"
                  className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 font-[var(--font-body)] lowercase focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: cloud_runner_123"
                />
                <button
                  type="button"
                  onClick={() => setUsername("")}
                  className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[8px] uppercase hover:bg-[var(--pixel-muted)]"
                >
                  Aleatorio
                </button>
              </div>
              <p className="mt-1 font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">
                Deixe vazio para gerar automaticamente.
              </p>
            </label>

            <label className="block font-[var(--font-body)] text-sm">
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

            <label className="block font-[var(--font-body)] text-sm">
              Senha
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 pr-16 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 font-[var(--font-pixel)] text-[8px] uppercase hover:bg-[var(--pixel-muted)]"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>

            <label className="block font-[var(--font-body)] text-sm">
              Confirmar senha
              <div className="relative mt-1">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 pr-16 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 border border-[var(--pixel-border)] bg-[var(--pixel-card)] px-2 py-1 font-[var(--font-pixel)] text-[8px] uppercase hover:bg-[var(--pixel-muted)]"
                  aria-label={showConfirmPassword ? "Ocultar confirmacao de senha" : "Mostrar confirmacao de senha"}
                >
                  {showConfirmPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>

            {error && (
              <PixelCard className="border-red-500 bg-red-900/30 py-2">
                <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
              </PixelCard>
            )}

            <PixelButton type="submit" disabled={loading} className="w-full">
              {loading ? "Criando conta..." : "Criar Conta"}
            </PixelButton>
          </form>

          <p className="text-center font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Já tem conta?{" "}
            <Link href="/login" className="font-semibold text-[var(--pixel-primary)] underline">
              Fazer login
            </Link>
          </p>
        </PixelCard>
      </div>
    </div>
  );
}
