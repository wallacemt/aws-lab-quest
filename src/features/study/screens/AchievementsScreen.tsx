"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AppLayout } from "@/components/ui/AppLayout";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { useAuth } from "@/hooks/useAuth";
import { AchievementItem } from "@/lib/achievements";

type AchievementsResponse = {
  achievements?: {
    total: number;
    unlockedCount: number;
    items: AchievementItem[];
  };
  error?: string;
};

function rarityLabelClass(rarity: AchievementItem["rarity"]): string {
  switch (rarity) {
    case "legendary":
      return "text-yellow-300";
    case "epic":
      return "text-fuchsia-300";
    case "rare":
      return "text-sky-300";
    case "uncommon":
      return "text-emerald-300";
    default:
      return "text-[var(--pixel-subtext)]";
  }
}

export function AchievementsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/achievements", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: AchievementsResponse) => {
        if (data.error) {
          throw new Error(data.error);
        }
        setItems(data.achievements?.items ?? []);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar conquistas.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCopyShareLink(item: AchievementItem) {
    if (!user?.id || !item.id || !item.unlocked) {
      return;
    }

    const url = `${window.location.origin}/share/achievement/${user.id}/${item.id}`;

    try {
      await navigator.clipboard.writeText(url);
      setShareMsg(`Link de ${item.name} copiado!`);
      window.setTimeout(() => setShareMsg(null), 2500);
    } catch {
      setShareMsg("Nao foi possivel copiar o link.");
      window.setTimeout(() => setShareMsg(null), 2500);
    }
  }

  const unlockedCount = items.filter((item) => item.unlocked).length;

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard className="space-y-3">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">Conquistas</p>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">
            Galeria de conquistas AWS
          </h1>
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Desbloqueie metas de estudo, acompanhe progresso e compartilhe as conquistas liberadas.
          </p>
          {!loading && !error && (
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
              {unlockedCount}/{items.length} desbloqueadas
            </p>
          )}
        </PixelCard>

        {shareMsg && (
          <PixelCard className="border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">{shareMsg}</p>
          </PixelCard>
        )}

        {loading && (
          <PixelCard>
            <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
          </PixelCard>
        )}

        {error && (
          <PixelCard className="border-red-500 bg-red-900/20">
            <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
          </PixelCard>
        )}

        {!loading && !error && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <PixelCard key={item.code} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
                      {item.name}
                    </p>
                    <p className={`font-[var(--font-pixel)] text-[8px] uppercase ${rarityLabelClass(item.rarity)}`}>
                      {item.rarity}
                    </p>
                  </div>
                  {!item.unlocked && <span className="text-base">🔒</span>}
                </div>

                <div className="relative mx-auto h-28 w-28 overflow-hidden border-2 border-[var(--pixel-border)]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={112}
                      height={112}
                      className={`h-full w-full object-cover ${item.unlocked ? "" : "grayscale opacity-40 blur-[1px]"}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
                      sem arte
                    </div>
                  )}
                  {!item.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 font-[var(--font-pixel)] text-lg">
                      🔒
                    </div>
                  )}
                </div>

                <p className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">{item.description}</p>

                {item.unlocked ? (
                  <div className="space-y-2">
                    <p className="font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-accent)]">
                      Desbloqueada {item.unlockedAt ? new Date(item.unlockedAt).toLocaleDateString("pt-BR") : ""}
                    </p>
                    <PixelButton type="button" onClick={() => void handleCopyShareLink(item)} disabled={!user?.id}>
                      Compartilhar conquista
                    </PixelButton>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden border border-[var(--pixel-border)] bg-[var(--pixel-bg)]">
                      <div className="h-full bg-[var(--pixel-primary)]" style={{ width: `${item.progressPercent}%` }} />
                    </div>
                    <p className="font-[var(--font-pixel)] text-[8px] uppercase text-[var(--pixel-subtext)]">
                      {item.current}/{item.target} ({item.progressPercent}%)
                    </p>
                  </div>
                )}
              </PixelCard>
            ))}
          </section>
        )}
      </main>
    </AppLayout>
  );
}
