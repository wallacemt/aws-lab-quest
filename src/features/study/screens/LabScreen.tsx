"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/ui/AppLayout";
import { SetupPanel } from "@/components/ui/SetupPanel";
import { PixelCard } from "@/components/ui/PixelCard";
import { useQuest } from "@/hooks/useQuest";
import { useUserProfile } from "@/hooks/useUserProfile";
import { extractBoardTitle } from "@/lib/retro";
import { STORAGE_KEYS } from "@/lib/storage";
import { Task } from "@/lib/types";

type QuestDraft = {
  theme: string;
  labText: string;
};

export function LabScreen() {
  const router = useRouter();
  const { profile, setProfile, hydrated } = useUserProfile();
  const { startQuest, activeQuest, hydrated: questHydrated } = useQuest();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const initialTheme = useMemo(() => profile.favoriteTheme || "games", [profile.favoriteTheme]);
  const [draft, setDraft] = useState<QuestDraft>({ theme: initialTheme, labText: "" });

  useEffect(() => {
    let nextDraft: QuestDraft = { theme: initialTheme, labText: "" };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.draftQuest);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<QuestDraft>;
        nextDraft = {
          theme: String(parsed.theme ?? initialTheme),
          labText: String(parsed.labText ?? ""),
        };
      }
    } catch {
      nextDraft = { theme: initialTheme, labText: "" };
    }

    setDraft(nextDraft);
    setDraftHydrated(true);
  }, [initialTheme]);

  useEffect(() => {
    if (!draftHydrated) return;
    const hasMeaningfulDraft = Boolean(
      draft.labText.trim() || (draft.theme.trim() && draft.theme.trim() !== initialTheme),
    );

    if (!hasMeaningfulDraft) {
      window.localStorage.removeItem(STORAGE_KEYS.draftQuest);
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.draftQuest, JSON.stringify(draft));
  }, [draft, draftHydrated, initialTheme]);

  const hasQuestInProgress = Boolean(activeQuest && !activeQuest.completed);

  async function handleGenerate(theme: string, labText: string) {
    if (hasQuestInProgress) {
      setError("Finalize a quest atual antes de criar uma nova.");
      return;
    }

    if (!theme || !labText) {
      setError("Preencha tema e texto do laboratório.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, labText }),
      });

      const data = (await response.json()) as { tasks?: Task[]; error?: string };
      if (!response.ok || !data.tasks) {
        throw new Error(data.error ?? "Falha ao gerar quest");
      }

      startQuest({ title: extractBoardTitle(labText), theme, sourceLabText: labText, tasks: data.tasks });
      void setProfile({ ...profile, favoriteTheme: theme }).catch(() => void 0);
      router.push("/quest");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao gerar quest.");
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated || !questHydrated || !draftHydrated) {
    return null;
  }

  return (
    <AppLayout credits>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">Modo Lab</h1>
          <p className="mt-2 font-[var(--font-body)] text-base text-[var(--pixel-subtext)]">
            Configure e gere quests a partir do conteúdo do seu laboratório AWS.
          </p>
        </PixelCard>

        {hasQuestInProgress && (
          <PixelCard className="space-y-3 border-yellow-500 bg-yellow-900/10">
            <p className="font-[var(--font-body)] text-sm text-yellow-300">
              Você já tem uma quest em andamento. Continue de onde parou para evitar novo consumo de tokens.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/quest")}
              className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
            >
              Continuar Quest Atual
            </button>
          </PixelCard>
        )}

        {!hasQuestInProgress && (
          <SetupPanel
            onGenerate={handleGenerate}
            theme={draft.theme}
            labText={draft.labText}
            onThemeChange={(value) => setDraft((prev) => ({ ...prev, theme: value }))}
            onLabTextChange={(value) => setDraft((prev) => ({ ...prev, labText: value }))}
            loading={loading}
            disabled={false}
          />
        )}

        {error && (
          <PixelCard className="border-red-500 bg-red-900/20">
            <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
          </PixelCard>
        )}
      </main>
    </AppLayout>
  );
}
