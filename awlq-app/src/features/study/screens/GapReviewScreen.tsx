"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, Maximize2, MessageCircle, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Message, MessageContent, MessageGroup, MessageHeader } from "@/components/ui/message";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuestionReviewPanel } from "@/features/study/components/QuestionReviewPanel";
import { toTopicCode } from "@/features/study/screens/ReviewScreen";
import {
  fetchGapProgress,
  fetchGapQuestions,
  GapChatTurn,
  GapProgress,
  sendGapChatMessage,
  StudyAnswerSnapshotPayload,
} from "@/features/study/services";
import { fetchTrails, QuestChain } from "@/features/trails/services/trails-api";
import { useUserProfile } from "@/hooks/useUserProfile";
import { MESTRE_AVATAR_URL } from "@/lib/mentor-assets";
import { buildReviewOptions } from "@/lib/study-option-text";
import { QuestionOption } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const { avatarUrl, profile } = useUserProfile();
  const [chatOpen, setChatOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [chatMessages, setChatMessages] = useState<GapChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: chatOpen ? "auto" : "smooth" });
  }, [chatMessages, chatLoading, chatOpen]);

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
    <Sheet
      open={chatOpen}
      onOpenChange={(open) => {
        setChatOpen(open);
        if (!open) setFullscreen(false);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <PixelButton variant="secondary" aria-label="Chat com especialista">
              <MessageCircle className="h-4 w-4" />
            </PixelButton>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>Tirar dúvidas com a IA sobre esta questão</TooltipContent>
      </Tooltip>

      <SheetContent
        className={cn("flex w-full flex-col gap-0 p-0", fullscreen ? "data-[side=right]:sm:max-w-full" : "sm:max-w-md")}
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-[var(--pixel-border)] pr-14">
          <div className="min-w-0">
            <SheetTitle className="truncate">Especialista em {serviceCode}</SheetTitle>
          </div>
          {fullscreen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sair da tela cheia"
                  onClick={() => setFullscreen(false)}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sair da tela cheia</TooltipContent>
            </Tooltip>
          )}
        </SheetHeader>

        {!fullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Expandir para tela cheia"
                onClick={() => setFullscreen(true)}
                className="absolute top-4 right-14 flex size-8 items-center justify-center rounded-[min(var(--radius-md),10px)] text-muted-foreground hover:bg-accent"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Tela cheia</TooltipContent>
          </Tooltip>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <MessageGroup className="px-4 py-4">
            {chatMessages.length === 0 && (
              <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
                Pergunte sobre esta questão ou sobre {serviceCode}.
              </p>
            )}
            {chatMessages.map((turn, index) => (
              <Message key={index} align={turn.role === "user" ? "end" : "start"}>
                <Avatar   className="mb-5  lg:min-h-14 lg:min-w-14">
                  {turn.role === "user" ? (
                    avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt="Você" />
                    ) : (
                      <AvatarFallback>{(profile.name || "V").charAt(0).toUpperCase()}</AvatarFallback>
                    )
                  ) : (
                    <AvatarImage src={MESTRE_AVATAR_URL} alt={`Mestre ${serviceCode}`} />
                  )}
                </Avatar>
                <MessageContent>
                  <MessageHeader>{turn.role === "user" ? "Você" : `Mestre ${serviceCode}`}</MessageHeader>
                  <div
                    className={cn(
                      "  rounded-2xl px-4 py-2.5 text-sm",
                      turn.role === "user"
                        ? "bg-[var(--pixel-primary)]/15 text-[var(--pixel-text)] lg:ml-42 ml-12"
                        : "bg-[var(--pixel-muted)] prose prose-sm prose-invert max-w-none prose-p:font-sans prose-p:leading-relaxed prose-li:font-sans prose-strong:text-[var(--pixel-primary)] prose-code:font-mono prose-code:text-xs prose-ul:my-1 prose-li:my-0.5",
                    )}
                  >
                    {turn.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
                    ) : (
                      turn.content
                    )}
                  </div>
                </MessageContent>
              </Message>
            ))}
            {chatLoading && (
              <Message align="start">
                <Avatar size="sm">
                  <AvatarImage src={MESTRE_AVATAR_URL} alt={`Mestre ${serviceCode}`} />
                </Avatar>
                <MessageContent className="w-fit">
                  <div className="flex items-center gap-1 rounded-2xl bg-[var(--pixel-muted)] px-4 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--pixel-subtext)] [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--pixel-subtext)] [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--pixel-subtext)]" />
                  </div>
                </MessageContent>
              </Message>
            )}
            {chatError && <p className="text-sm text-red-300">{chatError}</p>}
            <div ref={chatEndRef} />
          </MessageGroup>
        </ScrollArea>

        <div className="flex gap-2 border-t border-[var(--pixel-border)] p-4">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSendChat();
            }}
            placeholder="Digite sua dúvida..."
            className="flex-1 rounded-full border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-4 py-2 text-sm outline-none focus:border-[var(--pixel-primary)]"
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
  const [gapProgress, setGapProgress] = useState<GapProgress | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchGapProgress({ topic, awsServiceId })
      .then((progress) => {
        if (!cancelled) setGapProgress(progress);
      })
      .catch(() => {
        // Progress bar is a nice-to-have — a failed fetch just hides it.
      });

    return () => {
      cancelled = true;
    };
  }, [topic, awsServiceId]);

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
        <TooltipProvider>
          <PixelCard className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PixelButton variant="ghost" aria-label="Voltar" onClick={() => router.back()}>
                      <ArrowLeft className="h-4 w-4" />
                    </PixelButton>
                  </TooltipTrigger>
                  <TooltipContent>Voltar para a tela anterior</TooltipContent>
                </Tooltip>
                <div>
                  <p className="font-mono text-[10px] uppercase text-primary">Fechando gap</p>
                  <h1 className="font-[var(--font-body)] text-2xl">{serviceCode}</h1>
                </div>
              </div>

              <div className="flex gap-8   items-end justify-end">
                {selectedQuestion ? (
                  <GapChatPanel
                    key={selectedQuestion.questionId}
                    serviceCode={serviceCode}
                    questionStatement={selectedQuestion.statement}
                    correctAnswerText={correctAnswerText}
                  />
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <PixelButton variant="secondary" disabled aria-label="Chat com especialista">
                          <MessageCircle className="h-4 w-4" />
                        </PixelButton>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Carregando questões...</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PixelButton
                      onClick={() => router.push(`/kc?topics=${encodeURIComponent(toTopicCode(serviceCode))}`)}
                    >
                      <GraduationCap className="h-4 w-4" />
                    </PixelButton>
                  </TooltipTrigger>
                  <TooltipContent>Iniciar um Knowledge Check focado em {serviceCode}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {gapProgress && !gapProgress.cleared && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                    Progresso para fechar o gap
                  </p>
                  <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">
                    {gapProgress.consecutiveCorrect}/{gapProgress.threshold} acertos seguidos
                  </p>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--pixel-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--pixel-accent)] transition-all"
                    style={{
                      width: `${Math.round((gapProgress.consecutiveCorrect / gapProgress.threshold) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </PixelCard>
        </TooltipProvider>

        {relatedChains.length > 0 && (
          <PixelCard className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Trilhas relacionadas</p>
            <div className="flex flex-wrap gap-2">
              {relatedChains.map((chain) => (
                <PixelButton key={chain.id} variant="ghost" onClick={() => router.push(`/trilhas?chain=${chain.id}`)}>
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
