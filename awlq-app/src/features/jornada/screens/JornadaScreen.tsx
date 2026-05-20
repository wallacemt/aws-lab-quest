"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { JornadaMap, type JornadaStage } from "@/features/jornada/components/JornadaMap";

type JornadaData = {
  stages: JornadaStage[];
  totalCount: number;
  completedCount: number;
  currentStageIndex: number;
  certName: string | null;
};

export function JornadaScreen() {
  const router = useRouter();
  const [data, setData] = useState<JornadaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<JornadaStage | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/study/jornada", { credentials: "include" });
        if (!res.ok) throw new Error("Erro ao carregar a jornada.");
        const json = (await res.json()) as JornadaData;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard className="space-y-1">
          <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Jornada do Heroi</h1>
          <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Sua trilha de simulados rumo a certificacao AWS, do iniciante ao BOSS.
          </p>
        </PixelCard>

        {loading && (
          <PixelCard className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--pixel-primary)] border-r-transparent" />
              <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
                Carregando mapa da jornada...
              </p>
            </div>
          </PixelCard>
        )}

        {!loading && error && (
          <PixelCard className="border-red-500 bg-red-900/10">
            <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
            <PixelButton variant="ghost" onClick={() => router.push("/")} className="mt-3">
              Voltar ao inicio
            </PixelButton>
          </PixelCard>
        )}

        {!loading && !error && data && data.totalCount < 5 && (
          <PixelCard className="border-yellow-500 bg-yellow-900/10">
            <p className="font-mono text-[10px] uppercase text-yellow-300">Jornada Indisponivel</p>
            <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              A Jornada do Heroi requer pelo menos 5 packs de simulado ativos para sua certificacao.
              Atualmente ha {data.totalCount} pack(s) disponivel(is).
            </p>
            <PixelButton variant="ghost" onClick={() => router.push("/")} className="mt-4">
              Voltar ao inicio
            </PixelButton>
          </PixelCard>
        )}

        {!loading && !error && data && data.totalCount >= 5 && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* Map column */}
            <div className="space-y-4">
              {/* Progress header */}
              <PixelCard className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                    {data.certName ?? "Certificacao AWS"}
                  </p>
                  <p className="font-mono text-sm text-[var(--pixel-primary)]">
                    {data.completedCount}/{data.totalCount} fases concluidas
                  </p>
                </div>
                <div className="flex-1 max-w-32">
                  <div className="h-2 bg-[var(--pixel-border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--pixel-primary)] transition-all"
                      style={{ width: `${Math.round((data.completedCount / data.totalCount) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right font-mono text-[10px] text-[var(--pixel-subtext)]">
                    {Math.round((data.completedCount / data.totalCount) * 100)}%
                  </p>
                </div>
              </PixelCard>

              {/* The map */}
              <JornadaMap
                stages={data.stages}
                currentStageIndex={data.currentStageIndex === -1 ? data.totalCount : data.currentStageIndex}
                onSelectStage={setSelectedStage}
              />
            </div>

            {/* Detail panel */}
            <div className="space-y-4">
              {selectedStage ? (
                <PixelCard
                  className={`space-y-4 ${selectedStage.isBoss ? "border-yellow-500 bg-yellow-900/10" : "border-[var(--pixel-border)]"}`}
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                      Fase {selectedStage.stageNumber}{selectedStage.isBoss ? " · ⚡ BOSS" : ""}
                    </p>
                    <h2 className={`mt-1 font-mono text-sm font-bold ${selectedStage.isBoss ? "text-yellow-300" : "text-[var(--pixel-primary)]"}`}>
                      {selectedStage.narrative.stageName}
                    </h2>
                  </div>

                  {selectedStage.artworkUrl && (
                    <img
                      src={selectedStage.artworkUrl}
                      alt={selectedStage.packName}
                      className="w-full aspect-video object-cover border border-[var(--pixel-border)]"
                    />
                  )}

                  <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)] leading-relaxed">
                    {selectedStage.narrative.storyText}
                  </p>

                  <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 space-y-1">
                    <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Pack</p>
                    <p className="font-[var(--font-body)] text-sm">{selectedStage.packName}</p>
                    <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                      {selectedStage.questionCount} questoes · Score {selectedStage.difficultyScore}/10
                    </p>
                    <p className="font-mono text-[10px] text-[var(--pixel-accent)]">
                      AWS: {selectedStage.narrative.awsContext}
                    </p>
                  </div>

                  {selectedStage.completed ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase text-green-400">✓ Fase concluida</span>
                    </div>
                  ) : (
                    <PixelButton
                      className="w-full justify-center"
                      onClick={() => router.push("/simulado")}
                    >
                      Ir para o Simulado
                    </PixelButton>
                  )}
                </PixelCard>
              ) : (
                <PixelCard className="py-10 text-center space-y-2">
                  <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
                    Selecione uma fase no mapa para ver detalhes.
                  </p>
                  <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                    Fases com nevoa ainda nao foram desbloqueadas.
                  </p>
                </PixelCard>
              )}

              <PixelButton variant="ghost" onClick={() => router.push("/")} className="w-full justify-center">
                Voltar ao inicio
              </PixelButton>
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
