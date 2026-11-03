"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Lightbulb, RefreshCw } from "lucide-react";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RichText } from "@/components/rich-text/RichText";
import { FlashcardGradeBar } from "@/features/retention/components/FlashcardGradeBar";
import { Flashcard, FlashcardGrade } from "@/features/retention/services/retention-api";

type Props = {
  card: Flashcard;
  cardNumber: number;
  totalCards: number;
  isSubmitting: boolean;
  selectedGrade?: FlashcardGrade;
  onGrade: (grade: FlashcardGrade) => void;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
};

const FACE_STYLE = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;

export function FlashcardDeck({
  card,
  cardNumber,
  totalCards,
  isSubmitting,
  selectedGrade,
  onGrade,
  onPrev,
  onNext,
  canGoPrev,
}: Props) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [frontHasMore, setFrontHasMore] = useState(false);
  const [backHasMore, setBackHasMore] = useState(false);
  const [frontVisible, setFrontVisible] = useState(true);
  const reduceMotion = useReducedMotion();
  const frontBody = useRef<HTMLDivElement>(null);
  const backBody = useRef<HTMLDivElement>(null);
  const answerControls = useRef<HTMLButtonElement>(null);
  const gradeSection = useRef<HTMLDivElement>(null);
  const visibilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function measureOverflow(element: HTMLDivElement | null, setter: (value: boolean) => void) {
    if (!element) return;
    setter(element.scrollHeight > element.clientHeight + 4 && element.scrollTop + element.clientHeight < element.scrollHeight - 4);
  }

  useEffect(() => {
    const front = frontBody.current;
    const back = backBody.current;
    if (!front || !back) return;
    const update = () => {
      measureOverflow(front, setFrontHasMore);
      measureOverflow(back, setBackHasMore);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(front);
    observer.observe(back);
    return () => observer.disconnect();
  }, [card.front, card.back, card.hint, showHint]);

  useEffect(() => {
    if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
    if (reduceMotion) return;
    visibilityTimer.current = setTimeout(() => setFrontVisible(!isFlipped), 225);
    return () => {
      if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
    };
  }, [isFlipped, reduceMotion]);

  function handleFlip() {
    const next = !isFlipped;
    setIsFlipped(next);
    setShowHint(false);
    const body = next ? backBody.current : frontBody.current;
    if (body) body.scrollTop = 0;
    if (next) {
      requestAnimationFrame(() => {
        answerControls.current?.focus();
        const bounds = gradeSection.current?.getBoundingClientRect();
        if (bounds && (bounds.bottom > window.innerHeight || bounds.top < 0)) {
          gradeSection.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
        }
      });
    }
  }

  const face = (side: "front" | "back") => {
    const isFront = side === "front";
    const visibleFront = reduceMotion ? !isFlipped : frontVisible;
    const visible = isFront ? visibleFront : !visibleFront;
    const more = isFront ? frontHasMore : backHasMore;
    const bodyRef = isFront ? frontBody : backBody;
    return (
      <PixelCard
        className={`[grid-area:1/1] flex min-h-[220px] min-w-0 max-h-[var(--flashcard-face-max-h)] flex-col gap-0 overflow-hidden p-0 ${
          isFront ? "" : "border-[var(--pixel-accent)] bg-[var(--pixel-muted)]"
        }`}
        style={{ ...FACE_STYLE, transform: isFront ? undefined : "rotateY(180deg)", visibility: visible ? "visible" : "hidden" }}
        aria-hidden={!visible}
        inert={!visible}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-[var(--pixel-border)] px-4 py-3 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
          <span>{isFront ? "Pergunta" : "Resposta"}</span>
          <span>Card {cardNumber}/{totalCards}</span>
        </div>
        <div
          ref={bodyRef}
          onScroll={() => measureOverflow(bodyRef.current, isFront ? setFrontHasMore : setBackHasMore)}
          tabIndex={more ? 0 : undefined}
          role={more ? "region" : undefined}
          aria-label={isFront ? "Pergunta" : "Resposta"}
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [overflow-wrap:anywhere] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pixel-text)]"
        >
          {isFront ? (
            <div className="flex min-w-0 flex-col gap-3">
              <RichText
                text={card.front}
                trustLinks={true}
                className={`font-reading leading-relaxed text-[var(--pixel-text)] ${card.front.length <= 140 ? "text-xl font-semibold" : "text-base font-semibold"}`}
              />
              {card.hint && (
                <div>
                  <PixelButton type="button" variant="ghost" aria-expanded={showHint} aria-controls="flashcard-hint" onClick={() => setShowHint((value) => !value)} className="min-h-11 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)]">
                    <Lightbulb className="h-4 w-4" /> {showHint ? "Ocultar dica" : "Mostrar dica"}
                  </PixelButton>
                  {showHint && <div id="flashcard-hint" className="mt-3 border-l-2 border-[var(--pixel-border)] pl-3">
                    <p className="mb-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">Dica</p>
                    <p className="font-reading text-[0.8rem] leading-relaxed text-[var(--pixel-subtext)] [overflow-wrap:anywhere]">{card.hint}</p>
                  </div>}
                </div>
              )}
            </div>
          ) : (
            <RichText
              text={card.back}
              trustLinks={true}
              className="whitespace-pre-line font-reading text-base leading-relaxed text-[var(--pixel-text)] [overflow-wrap:anywhere]"
            />
          )}
          {more && <span aria-hidden="true" className="pixel-caret sticky bottom-0 float-right border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-1 font-mono text-[10px]">▼</span>}
        </div>
        <div className="flex shrink-0 justify-center border-t-2 border-[var(--pixel-border)] p-2">
          <PixelButton ref={isFront ? undefined : answerControls} type="button" variant="ghost" onClick={handleFlip} className="min-h-11 w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pixel-text)]">
            <RefreshCw className="h-4 w-4" /> Ver {isFront ? "resposta" : "pergunta"}
          </PixelButton>
        </div>
      </PixelCard>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid min-w-0" style={{ perspective: 1200 }}>
        <motion.div className="grid min-w-0" style={{ transformStyle: "preserve-3d" }} animate={{ rotateY: isFlipped && !reduceMotion ? 180 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeInOut" }}>
          {face("front")}
          {face("back")}
        </motion.div>
      </div>
      {isFlipped && <div ref={gradeSection} className="flex scroll-m-4 flex-col gap-3">
        <p className="text-center font-mono text-xs text-[var(--pixel-subtext)]">Como foi?</p>
        <FlashcardGradeBar onGrade={onGrade} selectedGrade={selectedGrade} disabled={isSubmitting} />
      </div>}
      <div className="flex flex-col items-center gap-2 pt-2">
        {!selectedGrade && <p className="text-center font-mono text-[8px] text-pixel-subtext">Avalie o card para avançar.</p>}
        <div className="flex items-center justify-center gap-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <PixelButton variant="ghost" onClick={onPrev} disabled={!canGoPrev} aria-label="Card anterior" className="min-h-11 min-w-11"><ChevronLeft className="h-4 w-4" /></PixelButton>
            </TooltipTrigger>
            <TooltipContent>Card anterior</TooltipContent>
          </Tooltip>
          <span className="font-mono text-xs text-[var(--pixel-subtext)]">Card {cardNumber} / {totalCards}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <PixelButton variant="ghost" onClick={onNext} disabled={isSubmitting || !selectedGrade} aria-label="Próximo card" className="min-h-11 min-w-11"><ChevronRight className="h-4 w-4" /></PixelButton>
            </TooltipTrigger>
            <TooltipContent>Próximo card</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
