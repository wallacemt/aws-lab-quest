"use client";

import { PixelButton } from "@/components/ui/pixel-button";
import { authClient } from "@/lib/auth-client";

type Provider = "google" | "github";

export function SocialLoginButtons({
  disabled,
  onError,
  callbackURL = "/home",
}: {
  disabled?: boolean;
  onError: (message: string) => void;
  callbackURL?: string;
}) {
  async function handleClick(provider: Provider) {
    const { error } = await authClient.signIn.social({ provider, callbackURL });

    if (error) {
      onError(error.message ?? "Nao foi possivel continuar com login social.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-[var(--pixel-border)]" />
        <span className="font-mono text-[8px] uppercase text-[var(--pixel-subtext)]">ou</span>
        <span className="h-px flex-1 bg-[var(--pixel-border)]" />
      </div>
      <PixelButton
        type="button"
        variant="ghost"
        disabled={disabled}
        className="w-full"
        onClick={() => void handleClick("google")}
      >
        Continuar com Google
      </PixelButton>
      <PixelButton
        type="button"
        variant="ghost"
        disabled={disabled}
        className="w-full"
        onClick={() => void handleClick("github")}
      >
        Continuar com GitHub
      </PixelButton>
    </div>
  );
}
