"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Message, MessageAvatar, MessageContent, MessageGroup } from "@/components/ui/message";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { QuestionReviewPanel } from "@/features/study/components/QuestionReviewPanel";
import { toTopicCode } from "@/features/study/screens/ReviewScreen";
import {
  fetchGapQuestions,
  GapChatTurn,
  sendGapChatMessage,
  StudyAnswerSnapshotPayload,
} from "@/features/study/services";
import { fetchTrails, QuestChain } from "@/features/trails/services/trails-api";
import { buildReviewOptions } from "@/lib/study-option-text";
import { QuestionOption } from "@/lib/types";

type GapReviewScreenProps = {
  serviceCode: string;
  topic: string;
  awsServiceId: string | null;
};

type GapChatPanelProps = {
  serviceCode: string;
  questionStatement: string;
  correctAnswerText: string;
};

// Keyed by questionId in the parent so a fresh conversation starts per
// question via remount, instead of resetting state inside an effect.
function GapChatPanel({ serviceCode, questionStatement, correctAnswerText }: GapChatPanelProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<GapChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  async function handleSendChat() {
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    setChatInput("");
    setChatError(null);
    const nextHistory: GapChatTurn[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextHistory);
    setChatLoading(true);

    try {
      const answer = await sendGapChatMessage({
        message,
        serviceName: serviceCode,
        questionStatement,
        correctAnswerText,
        history: chatMessages,
      });
      setChatMessages([...nextHistory, { role: "assistant", content: answer }]);
    } catch (chatSendError) {
      setChatError(chatSendError instanceof Error ? chatSendError.message : "Falha ao conversar com o especialista.");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <Sheet open={chatOpen} onOpenChange={setChatOpen}>
      <SheetTrigger asChild>
        <PixelButton variant="secondary">Chat com especialista</PixelButton>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Especialista em {serviceCode}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          <ScrollArea className="h-[60vh] w-full">
            <MessageGroup className="pr-2">
              {chatMessages.length === 0 && (
                <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                  Pergunte sobre esta questão ou sobre {serviceCode}.
                </p>
              )}
              {chatMessages.map((turn, index) => (
                <Message key={index} align={turn.role === "user" ? "end" : "start"}>
                  <MessageAvatar>
                    <Avatar size="sm">
                      <AvatarFallback>{turn.role === "user" ? "V" : "IA"}</AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                  <MessageContent>
                    <div
                      className={
                        turn.role === "user"
                          ? "max-w-[85%] border border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/10 px-3 py-2 text-sm"
                          : "max-w-[85%] border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm"
                      }
                    >
                      {turn.content}
                    </div>
                  </MessageContent>
                </Message>
              ))}
              {chatLoading && (
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                  Especialista digitando...
                </p>
              )}
              {chatError && <p className="text-sm text-red-300">{chatError}</p>}
              <div ref={chatEndRef} />
            </MessageGroup>
          </ScrollArea>
        </div>

        <div className="flex gap-2 border-t border-[var(--pixel-border)] p-4">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSendChat();
            }}
            placeholder="Digite sua dúvida..."
            className="flex-1 border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-2 text-sm outline-none"
          />
          <PixelButton onClick={() => void handleSendChat()} disabled={chatLoading || !chatInput.trim()}>
            Enviar
          </PixelButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function GapReviewScreen({ serviceCode, topic, awsServiceId }: GapReviewScreenProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<StudyAnswerSnapshotPayload[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [relatedChains, setRelatedChains] = useState<QuestChain[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchGapQuestions({ topic, awsServiceId });
        if (!cancelled) {
          setQuestions(items);
          setSelectedIndex(0);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Falha ao carregar questões do gap.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [topic, awsServiceId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRelatedTrails() {
      try {
        const { chains } = await fetchTrails();
        if (cancelled) return;
        const matching = chains.filter((chain) =>
          chain.stages.some(
            (stage) =>
              (awsServiceId && stage.awsServiceId === awsServiceId) ||
              (stage.topic && stage.topic.trim().toUpperCase() === topic.trim().toUpperCase()),
          ),
        );
        setRelatedChains(matching);
      } catch {
        // Trilhas relacionadas são um extra — falha silenciosa não bloqueia a revisão.
      }
    }

    void loadRelatedTrails();
    return () => {
      cancelled = true;
    };
  }, [topic, awsServiceId]);

  const selectedQuestion = questions[selectedIndex] ?? null;

  const reviewOptions = useMemo(() => {
    if (!selectedQuestion) return [];
    return buildReviewOptions(selectedQuestion).map((item) => ({
      ...item,
      option: item.option as QuestionOption,
    }));
  }, [selectedQuestion]);

  const correctAnswerText = useMemo(() => {
    const correctOption = reviewOptions.find((item) => item.isCorrect);
    return correctOption?.text ?? "";
  }, [reviewOptions]);

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 xl:px-8">
        <PixelCard className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Fechando gap</p>
              <h1 className="font-[var(--font-body)] text-2xl">{serviceCode}</h1>
            </div>
            <PixelButton variant="ghost" onClick={() => router.back()}>
              ← Voltar
            </PixelButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <PixelButton onClick={() => router.push(`/kc?topics=${encodeURIComponent(toTopicCode(serviceCode))}`)}>
              Fazer KC sobre {serviceCode}
            </PixelButton>
          </div>
        </PixelCard>

        {relatedChains.length > 0 && (
          <PixelCard className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Trilhas relacionadas</p>
            <div className="flex flex-wrap gap-2">
              {relatedChains.map((chain) => (
                <PixelButton
                  key={chain.id}
                  variant="ghost"
                  onClick={() => router.push(`/trilhas?chain=${chain.id}`)}
                >
                  {chain.name}
                </PixelButton>
              ))}
            </div>
          </PixelCard>
        )}

        {loading && (
          <PixelCard>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Carregando questões...</p>
          </PixelCard>
        )}

        {!loading && error && (
          <PixelCard>
            <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>
          </PixelCard>
        )}

        {!loading && !error && questions.length === 0 && (
          <PixelCard>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
              Nenhuma questão errada encontrada para este gap.
            </p>
          </PixelCard>
        )}

        {!loading && !error && questions.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
            <section className="space-y-4">
              {selectedQuestion && (
                <PixelCard className="space-y-3">
                  <QuestionReviewPanel
                    isCorrect={false}
                    loading={false}
                    options={reviewOptions}
                    questionStatement={selectedQuestion.statement}
                    questionIndex={selectedIndex + 1}
                    questionCount={questions.length}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <PixelButton
                        variant="ghost"
                        disabled={selectedIndex === 0}
                        onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                      >
                        Anterior
                      </PixelButton>
                      <PixelButton
                        disabled={selectedIndex >= questions.length - 1}
                        onClick={() => setSelectedIndex((i) => Math.min(questions.length - 1, i + 1))}
                      >
                        Próxima
                      </PixelButton>
                    </div>

                    <GapChatPanel
                      key={selectedQuestion.questionId}
                      serviceCode={serviceCode}
                      questionStatement={selectedQuestion.statement}
                      correctAnswerText={correctAnswerText}
                    />
                  </div>
                </PixelCard>
              )}
            </section>

            <aside className="space-y-2 xl:sticky xl:top-24 xl:self-start">
              <PixelCard className="space-y-2">
                <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Questões</p>
                <div className="grid grid-cols-5 gap-2 xl:grid-cols-4">
                  {questions.map((q, index) => (
                    <button
                      key={q.questionId}
                      onClick={() => setSelectedIndex(index)}
                      className={`border px-2 py-2 font-mono text-[10px] uppercase ${
                        index === selectedIndex
                          ? "border-[var(--pixel-primary)] bg-[var(--pixel-primary)]/20"
                          : "border-[#e74c3c] bg-red-900/20"
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </PixelCard>
            </aside>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
