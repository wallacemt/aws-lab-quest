"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { CreatorCredits } from "@/components/CreatorCredits";
import { QuestHistory } from "@/components/QuestHistory";
import { SetupPanel } from "@/components/SetupPanel";
import { UserProfileModal } from "@/components/UserProfileModal";
import { PixelCard } from "@/components/ui/PixelCard";
import { useQuest } from "@/hooks/useQuest";
import { useUserProfile } from "@/hooks/useUserProfile";
import { extractBoardTitle } from "@/lib/retro";
import { STORAGE_KEYS } from "@/lib/storage";

type QuestDraft = {
  theme: string;
  labText: string;
};

export function HomeScreen() {
  const router = useRouter();
  const { profile, setProfile, hydrated } = useUserProfile();
  const { startQuest, history, activeQuest, hydrated: questHydrated } = useQuest();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
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
    if (!draftHydrated) {
      return;
    }

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
      setError("Preencha tema e texto do laboratorio.");
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

      const data = (await response.json()) as { tasks?: unknown[]; error?: string };
      if (!response.ok || !data.tasks) {
        throw new Error(data.error ?? "Falha ao gerar quest");
      }

      startQuest({ title: extractBoardTitle(labText), theme, tasks: data.tasks as never[] });
      setProfile({ ...profile, favoriteTheme: theme });
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
    <div className="min-h-screen">
      <Header xp={0} name={profile.name} onEditProfile={() => setShowProfileModal(true)}  />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <PixelCard>
            <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">
              EDN Cloud Academy
            </h1>
            <p className="mt-2 font-[var(--font-body)] text-lg">
              Treine labs AWS em formato de fase retro. Monte seu quest e avance para sua certificacao.
            </p>
          </PixelCard>
          {hasQuestInProgress ? (
            <PixelCard className="space-y-3 border-yellow-500">
              <p className="font-[var(--font-body)] text-sm text-yellow-300">
                Voce ja tem uma quest em andamento. Continue de onde parou para evitar novo consumo de token.
              </p>
              <button
                type="button"
                onClick={() => {
                  router.replace("/quest");
                }}
                className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase"
              >
                Continuar Quest Atual
              </button>
            </PixelCard>
          ) : null}
          {!hasQuestInProgress ? (
            <SetupPanel
              onGenerate={handleGenerate}
              theme={draft.theme}
              labText={draft.labText}
              onThemeChange={(value) => setDraft((prev) => ({ ...prev, theme: value }))}
              onLabTextChange={(value) => setDraft((prev) => ({ ...prev, labText: value }))}
              loading={loading}
              disabled={false}
            />
          ) : null}
          {error ? (
            <PixelCard className="border-red-500 text-red-300">
              <p className="font-[var(--font-body)] text-sm">{error}</p>
            </PixelCard>
          ) : null}
        </div>
        <QuestHistory history={history} />
      </main>
      <UserProfileModal
        profile={profile}
        onSave={setProfile}
        open={showProfileModal || !profile.name}
        onClose={() => setShowProfileModal(false)}
      />
      <CreatorCredits />
    </div>
  );
}
