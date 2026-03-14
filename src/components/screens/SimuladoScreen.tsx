"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { PixelButton } from "@/components/ui/PixelButton";
import { PixelCard } from "@/components/ui/PixelCard";
import { SIMULATED_QUESTIONS } from "@/lib/question-bank";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mm = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function SimuladoScreen() {
  const router = useRouter();
  const { hydrated, isActive, remainingSeconds, session, startSession, submitSession, clearSession } =
    useSimulatedExam();

  const minutesLabel = useMemo(() => formatTime(remainingSeconds), [remainingSeconds]);

  if (!hydrated) {
    return (
      <AppLayout>
        <main className="flex min-h-[60vh] items-center justify-center">
          <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard>
          <h1 className="font-[var(--font-pixel)] text-sm uppercase text-[var(--pixel-primary)]">Modo Simulado AWS</h1>
          <p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            Simulacao de prova com 90 minutos. Enquanto o simulado estiver ativo, o app bloqueia outras acoes ate
            finalizar o tempo ou enviar a prova.
          </p>
        </PixelCard>

        {!isActive && (
          <PixelCard className="space-y-4">
            <h2 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">
              Pronto para iniciar?
            </h2>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Ao iniciar, voce ficara no modo prova e nao podera navegar para outras telas ate finalizar.
            </p>
            <PixelButton onClick={() => startSession("CLF-C02", 90)}>Iniciar Simulado (90 min)</PixelButton>
          </PixelCard>
        )}

        {isActive && (
          <>
            <PixelCard className="flex flex-wrap items-center justify-between gap-3 border-red-600 bg-red-900/10">
              <div>
                <p className="font-[var(--font-pixel)] text-[10px] uppercase text-red-300">Prova em andamento</p>
                <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                  Certificacao: {session?.certificationCode ?? "CLF-C02"}
                </p>
              </div>
              <div className="border-2 border-red-400 px-4 py-2 font-[var(--font-pixel)] text-lg text-red-300">
                {minutesLabel}
              </div>
            </PixelCard>

            <div className="space-y-4">
              {SIMULATED_QUESTIONS.map((question, index) => (
                <PixelCard key={question.id} className="space-y-3">
                  <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-subtext)]">
                    Questao {index + 1} · {question.topic} · {question.difficulty}
                  </p>
                  <p className="font-[var(--font-body)] text-base">{question.statement}</p>
                  <div className="grid gap-2">
                    {Object.entries(question.options).map(([option, value]) => (
                      <label
                        key={`${question.id}-${option}`}
                        className="flex items-start gap-2 border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2"
                      >
                        <input type="radio" name={question.id} value={option} />
                        <span className="font-[var(--font-body)] text-sm">
                          {option}) {value}
                        </span>
                      </label>
                    ))}
                  </div>
                </PixelCard>
              ))}
            </div>

            <PixelCard className="flex flex-wrap items-center justify-end gap-2">
              <PixelButton
                variant="ghost"
                onClick={() => {
                  submitSession();
                  router.replace("/");
                }}
              >
                Entregar Prova
              </PixelButton>
              <PixelButton
                onClick={() => {
                  clearSession();
                  router.replace("/");
                }}
              >
                Encerrar e Sair
              </PixelButton>
            </PixelCard>
          </>
        )}

        {!isActive && session && (
          <PixelCard className="space-y-3 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/10">
            <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">
              Simulado finalizado
            </p>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Sua sessao anterior foi encerrada. Inicie um novo simulado quando quiser.
            </p>
          </PixelCard>
        )}
      </main>
    </AppLayout>
  );
}
