"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import appLogo from "@/assets/logo.png";
import { EyeClosed, EyeIcon } from "lucide-react";

export function LoginScreen() {
  return <LoginScreenBase mode="user" />;
}

export function AdminLoginScreen() {
  return <LoginScreenBase mode="admin" />;
}

function LoginScreenBase({ mode }: { mode: "user" | "admin" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkAdminAccess(): Promise<boolean> {
    const response = await fetch("/api/admin/status", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    return response.ok;
  }

  async function checkUserAccessStatus(): Promise<{
    active: boolean;
    accessStatus: "pending" | "approved" | "rejected";
  } | null> {
    const response = await fetch("/api/user/access-status", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as {
      active: boolean;
      accessStatus: "pending" | "approved" | "rejected";
    };
  }

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
    
    const access = await checkUserAccessStatus();
    if (!access || !access.active) {
      await authClient.signOut();
      setError("Conta desativada. Entre em contato com o administrador.");
      setLoading(false);
      return;
    }

    if (access.accessStatus === "pending") {
      await authClient.signOut();
      setError("Cadastro recebido. Aguarde a aprovacao de um administrador para acessar.");
      setLoading(false);
      return;
    }

    if (access.accessStatus === "rejected") {
      await authClient.signOut();
      setError("Seu cadastro foi recusado. Entre em contato com o administrador.");
      setLoading(false);
      return;
    }

    const from = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
    const safeTarget = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";

    const isAdmin = await checkAdminAccess();

    if (mode === "admin") {
      if (!isAdmin) {
        await authClient.signOut();
        setError("Conta sem permissao de administrador.");
        setLoading(false);
        return;
      }

      router.replace("/admin");
      return;
    }

    if (isAdmin) {
      router.replace("/admin");
      return;
    }

    router.replace(safeTarget);
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
              alt="AWS Quest logo"
              width={124}
              height={124}
              priority
              className="h-auto w-28 sm:w-32"
            />
          </div>
          <h1 className="font-mono text-xl text-primary drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">AWS QUEST</h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Entre para começar sua jornada na nuvem
          </p>
        </div>

        <PixelCard className="w-full max-w-md space-y-5">
          <h2 className="text-center font-mono text-xs uppercase text-[var(--pixel-primary)]">Login</h2>
          {mode === "admin" && (
            <p className="text-center font-sans text-xs text-[var(--pixel-subtext)] flex items-center flex-col  justify-center">
              <span className="font-mono">(ADMIN)</span> Area restrita para administradores
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoComplete="current-password"
                  className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 pr-16 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2   px-2 py-1 font-mono text-[8px] uppercase ]"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeClosed /> : <EyeIcon />}
                </button>
              </div>
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
          {mode !== "admin" && (
            <p className="text-center font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Não tem conta?{" "}
              <Link href="/register" className="font-semibold text-[var(--pixel-primary)] underline">
                Criar conta
              </Link>
            </p>
          )}
        </PixelCard>
      </div>
    </div>
  );
}
