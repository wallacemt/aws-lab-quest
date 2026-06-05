"use client";

type Question = {
  id: string;
  statement: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE?: string | null;
};

type Props = {
  bossName: string;
  bossArtworkUrl: string | null;
  maxHp: number;
  remainingHp: number;
  question: Question | null;
  selectedOption: number | null;
  onSelectOption: (index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  damageFlash: number | null; // damage number shown briefly after submit
  victory: boolean;
};

const OPTIONS = ["A", "B", "C", "D", "E"] as const;

function HpBar({ max, current }: { max: number; current: number }) {
  const pct = Math.max(0, Math.round((current / max) * 100));
  const color = pct > 50 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-xs text-[#94a3b8]">
        <span>HP</span>
        <span>
          {current} / {max}
        </span>
      </div>
      <div className="h-3 w-full rounded bg-[#1e293b]">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function BossBattleStage({
  bossName,
  bossArtworkUrl,
  maxHp,
  remainingHp,
  question,
  selectedOption,
  onSelectOption,
  onSubmit,
  submitting,
  damageFlash,
  victory,
}: Props) {
  const optionTexts: Record<string, string | undefined | null> = {
    A: question?.optionA,
    B: question?.optionB,
    C: question?.optionC,
    D: question?.optionD,
    E: question?.optionE,
  };

  return (
    <div className="space-y-6">
      {/* Boss header */}
      <div className="flex items-center gap-4 border border-[#1e293b] bg-[#0f172a] p-4">
        {bossArtworkUrl ? (
          <img src={bossArtworkUrl} alt={bossName} className="h-20 w-20 rounded object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded border border-[#334155] bg-[#1e293b] font-mono text-2xl text-[#f97316]">
            B
          </div>
        )}
        <div className="flex-1 space-y-2">
          <p className="font-mono text-sm font-semibold uppercase text-[#f97316]">{bossName}</p>
          <HpBar max={maxHp} current={remainingHp} />
          {damageFlash !== null && (
            <p className="animate-bounce font-mono text-xs font-bold text-red-400">
              -{damageFlash} HP
            </p>
          )}
        </div>
      </div>

      {victory && (
        <div className="border border-[#22c55e] bg-[#052e16] p-4 text-center">
          <p className="font-mono text-lg font-bold text-[#22c55e]">Vitória!</p>
          <p className="mt-1 font-mono text-xs text-[#86efac]">Você derrotou {bossName}!</p>
        </div>
      )}

      {!victory && question && (
        <div className="space-y-4">
          <p className="border border-[#1e293b] bg-[#111827] p-4 font-[var(--font-body)] text-sm leading-6 text-[#e2e8f0]">
            {question.statement}
          </p>

          <div className="space-y-2">
            {OPTIONS.map((letter, idx) => {
              const text = optionTexts[letter];
              if (!text) return null;

              const isSelected = selectedOption === idx;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => onSelectOption(idx)}
                  className={[
                    "w-full border px-4 py-3 text-left font-mono text-xs transition-colors",
                    isSelected
                      ? "border-[#f97316] bg-[#1f2937] text-[#f97316]"
                      : "border-[#1e293b] text-[#cbd5e1] hover:border-[#334155] hover:bg-[#0f172a]",
                  ].join(" ")}
                >
                  <span className="mr-3 font-bold">{letter}.</span>
                  {text}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={selectedOption === null || submitting}
            className="w-full border border-[#f97316] bg-[#f97316]/10 px-4 py-3 font-mono text-xs font-bold uppercase text-[#f97316] transition-colors hover:bg-[#f97316]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Atacar"}
          </button>
        </div>
      )}
    </div>
  );
}
