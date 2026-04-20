"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { EyeClosed, EyeIcon } from "lucide-react";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const resetErrorCode = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Token de redefinicao ausente. Solicite um novo link.");
      return;
    }

    if (password.length < 8) {
      setError("A senha deve ter no minimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas nao coincidem.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const payload = (await response.json()) as { message?: string; code?: string };

      if (!response.ok) {
        if (payload.code === "INVALID_TOKEN") {
          throw new Error("Link invalido ou expirado. Solicite um novo link de redefinicao.");
        }

        throw new Error(payload.message ?? "Nao foi possivel redefinir sua senha.");
      }

      setSuccess("Senha redefinida com sucesso. Voce sera redirecionado para o login.");
      setPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        router.replace("/login");
      }, 1400);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  }

  const tokenError = resetErrorCode === "INVALID_TOKEN";

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
            Crie sua nova senha para voltar ao app.
          </p>
        </div>

        <PixelCard className="w-full max-w-md space-y-5">
          <h2 className="text-center font-mono text-xs uppercase text-[var(--pixel-primary)]">Redefinir senha</h2>

          {(tokenError || !token) && (
            <PixelCard className="border-yellow-500 bg-yellow-900/30 py-2">
              <p className="font-[var(--font-body)] text-sm text-yellow-300">
                Link invalido ou expirado. Solicite uma nova redefinicao.
              </p>
            </PixelCard>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block font-[var(--font-body)] text-sm">
              Nova senha
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 pr-16 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute cursor-pointer z-2 right-1 top-1/2 -translate-y-1/2 px-2 py-1"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeClosed /> : <EyeIcon />}
                </button>
              </div>
            </label>

            <label className="block font-[var(--font-body)] text-sm">
              Confirmar nova senha
              <div className="relative mt-1">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  className="w-full border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 pr-16 font-[var(--font-body)] focus:outline-none focus:ring-2 focus:ring-[var(--pixel-primary)]"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1"
                  aria-label={showConfirmPassword ? "Ocultar confirmacao de senha" : "Mostrar confirmacao de senha"}
                  title={showConfirmPassword ? "Ocultar confirmacao de senha" : "Mostrar confirmacao de senha"}
                >
                  {showConfirmPassword ? <EyeClosed /> : <EyeIcon />}
                </button>
              </div>
            </label>

            {error && (
              <PixelCard className="border-red-500 bg-red-900/30 py-2">
                <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
              </PixelCard>
            )}

            {success && (
              <PixelCard className="border-green-500 bg-green-900/30 py-2">
                <p className="font-[var(--font-body)] text-sm text-green-300">{success}</p>
              </PixelCard>
            )}

            <PixelButton type="submit" disabled={loading || !token} className="w-full">
              {loading ? "Salvando..." : "Salvar nova senha"}
            </PixelButton>
          </form>

          <p className="text-center font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Precisa de um novo link?{" "}
            <Link href="/forgot-password" className="font-semibold text-[var(--pixel-primary)] underline">
              Solicitar novamente
            </Link>
          </p>
        </PixelCard>
      </div>
    </div>
  );
}
