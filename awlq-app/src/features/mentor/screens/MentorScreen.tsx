"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { MentorActionList } from "@/features/mentor/components/MentorActionList";
import {
  fetchMentorRecommendations,
  fetchAskStatus,
  askMentorQuestion,
  DailyLimitError,
  type MentorRecommendation,
  type AskStatus,
} from "@/features/mentor/services/mentor-api";
import Image from "next/image";

const SMOKE_PARTICLES = [
  { left: "20%", delay: 0, size: "w-20 h-20" },
  { left: "45%", delay: 0.8, size: "w-14 h-14" },
  { left: "70%", delay: 1.6, size: "w-3 h-8" },
  { left: "35%", delay: 2.4, size: "w-32 h-12" },
  { left: "60%", delay: 1.2, size: "w-12 h-6" },
  { left: "65%", delay: 1.5, size: "w-8 h-6" },
  { left: "70%", delay: 1.1, size: "w-9 h-6" },
];

/**
 * Full mentor screen with Mestre Yoda persona.
 * Loads ranked recommendations and presents them under the Yoda avatar card.
 */
export function MentorScreen() {
  const [recommendations, setRecommendations] = useState<MentorRecommendation[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ask-the-mentor state
  const [askStatus, setAskStatus] = useState<AskStatus | null>(null);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, status] = await Promise.all([fetchMentorRecommendations(), fetchAskStatus()]);
      setRecommendations(data.recommendations);
      setGeneratedAt(data.generatedAt);
      setAskStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar recomendações.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || isAsking) return;
    setIsAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const result = await askMentorQuestion(question.trim());
      setAnswer(result.answer);
      setAskStatus({ canAsk: false, resetsAt: result.resetsAt });
    } catch (err) {
      if (err instanceof DailyLimitError) {
        setAskStatus({ canAsk: false, resetsAt: err.resetsAt });
      } else {
        setAskError(err instanceof Error ? err.message : "Erro ao contatar o Mestre.");
      }
    } finally {
      setIsAsking(false);
    }
  }, [question, isAsking]);

  const updatedLabel = generatedAt
    ? `Atualizado ${formatDistanceToNow(new Date(generatedAt), { addSuffix: true, locale: ptBR })}`
    : null;

  const resetLabel = askStatus?.resetsAt
    ? formatDistanceToNow(new Date(askStatus.resetsAt), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        {/* Yoda avatar card with smoke effect */}
        <PixelCard className="relative overflow-hidden border-green-700/60">
          {/* Smoke particles (behind content) */}
          {SMOKE_PARTICLES.map((p, i) => (
            <motion.div
              key={i}
              className={`absolute ${p.size} bg-green-500  blur-lg pointer-events-none`}
              style={{ left: p.left, bottom: 0, zIndex: 0 }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: -80, opacity: [0, 0.5, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: p.delay,
                ease: "easeIn",
                repeatDelay: 0.5,
              }}
            />
          ))}

          {/* Ambient glow */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-green-500/40 blur-3xl pointer-events-none" />

          {/* Avatar + info */}
          <div className="relative z-10 flex items-center gap-5">
            <div className="shrink-0 w-42 h-42 border-2 border-green-500 bg-green-900/40 flex items-center justify-center text-5xl shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <Image
                src={
                  "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/simulado-artwork/orphan/ai_mentor.png"
                }
                height={200}
                width={200}
                className=" object-cover"
                alt="Ai Mentor"
              />
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase text-[var(--pixel-subtext)] tracking-widest mb-1">
                Mestre AWS — IA Mentor
              </p>
              <h1 className="font-mono text-md font-bold uppercase text-[var(--pixel-text)]">Guia do Jedi AWS</h1>
              <p className="font-mono text-[11px] text-[var(--pixel-subtext)] mt-1 italic">
                &ldquo;Forte na Cloud, você deve ser. O caminho da certificação, longo é — mas começar, o mais
                importante.&rdquo;
              </p>
            </div>
          </div>
        </PixelCard>

        {/* Last updated as Yoda line */}
        {updatedLabel && (
          <p className="font-mono text-xs text-[var(--pixel-subtext)] italic">
            &ldquo;{updatedLabel}, a última análise foi.&rdquo;
          </p>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <PixelCard className="border-red-500/40">
            <p className="font-mono text-xs text-red-400">
              &ldquo;Carregar suas recomendações, não consegui. Tentar novamente, você deve: {error}&rdquo;
            </p>
            <PixelButton variant="ghost" className="mt-3 text-xs" onClick={() => void load()}>
              Tentar novamente
            </PixelButton>
          </PixelCard>
        )}

        {/* Recommendations */}
        <PixelCard className="space-y-4">
          <p className="font-mono text-xs uppercase text-[var(--pixel-text)] tracking-widest">
            Suas prioridades de hoje
          </p>
          <MentorActionList recommendations={isLoading ? null : (recommendations ?? [])} isLoading={isLoading} />
        </PixelCard>

        {/* Pergunta ao Mestre */}
        <PixelCard className="space-y-4">
          <p className="font-mono text-xs uppercase text-[var(--pixel-text)] tracking-widest">
            Pergunta ao Mestre
          </p>

          {/* Loading: waiting for status check */}
          {askStatus === null && (
            <p className="font-mono text-xs text-[var(--pixel-subtext)]">
              Verificando disponibilidade do Mestre...
            </p>
          )}

          {/* Locked: daily limit reached */}
          {askStatus !== null && !askStatus.canAsk && (
            <div className="space-y-2">
              <p className="font-mono text-xs text-[var(--pixel-subtext)] italic">
                &ldquo;Sua pergunta diária já foi usada. O Mestre responderá novamente {resetLabel}.&rdquo;
              </p>
              {answer && (
                <div className="border border-green-700/40 bg-green-900/10 p-3 space-y-1">
                  <p className="font-mono text-[10px] uppercase text-green-400 tracking-widest">Resposta do Mestre</p>
                  <p className="font-mono text-xs text-[var(--pixel-text)] whitespace-pre-wrap">{answer}</p>
                </div>
              )}
            </div>
          )}

          {/* Available: can ask */}
          {askStatus !== null && askStatus.canAsk && (
            <div className="space-y-3">
              <textarea
                className="w-full bg-transparent border border-[var(--pixel-border)] font-mono text-xs text-[var(--pixel-text)] p-2 resize-none focus:outline-none focus:border-green-500 placeholder:text-[var(--pixel-subtext)]"
                rows={3}
                maxLength={500}
                placeholder="Qual é sua dúvida sobre AWS, jovem Padawan?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isAsking}
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                  {question.length}/500
                </span>
                <PixelButton
                  onClick={() => void handleAsk()}
                  disabled={isAsking || !question.trim()}
                  className="text-xs"
                >
                  {isAsking ? "Consultando o Mestre..." : "Perguntar"}
                </PixelButton>
              </div>

              {askError && (
                <p className="font-mono text-xs text-red-400">
                  &ldquo;{askError}&rdquo;
                </p>
              )}

              {answer && (
                <div className="border border-green-700/40 bg-green-900/10 p-3 space-y-1">
                  <p className="font-mono text-[10px] uppercase text-green-400 tracking-widest">Resposta do Mestre</p>
                  <p className="font-mono text-xs text-[var(--pixel-text)] whitespace-pre-wrap">{answer}</p>
                </div>
              )}
            </div>
          )}
        </PixelCard>
      </div>
    </AppLayout>
  );
}
