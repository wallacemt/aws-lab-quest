import type { WeeklyChallengeData } from "@/features/arena/services/arena-api";

type Props = {
  data: WeeklyChallengeData;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function WeeklyChallengeCard({ data }: Props) {
  const { challenge, entry, leaderboard } = data;

  if (!challenge) {
    return (
      <div className="border border-[#1e293b] bg-[#0f172a] p-6 text-center">
        <p className="font-mono text-xs text-[#94a3b8]">Nenhum desafio ativo no momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-[#1e293b] bg-[#0f172a] p-4">
        <p className="font-mono text-xs uppercase text-[#f97316]">Desafio da Semana</p>
        <p className="mt-1 font-mono text-[10px] text-[#94a3b8]">
          {formatDate(challenge.weekStart)} — {formatDate(challenge.weekEnd)}
        </p>
        {entry && (
          <div className="mt-3 flex gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Sua pontuação</p>
              <p className="font-mono text-lg font-bold text-[#38bdf8]">{entry.score}</p>
            </div>
            {entry.rank !== null && (
              <div>
                <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Ranking</p>
                <p className="font-mono text-lg font-bold text-[#f97316]">#{entry.rank}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {leaderboard.length > 0 && (
        <div className="border border-[#1e293b] bg-[#0f172a] p-4">
          <p className="mb-3 font-mono text-[10px] uppercase text-[#94a3b8]">Top 10</p>
          <ol className="space-y-2">
            {leaderboard.map((item, idx) => (
              <li key={item.userId} className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#94a3b8]">#{item.rank ?? idx + 1}</span>
                <span className="truncate text-[#cbd5e1]">{item.userId.slice(0, 8)}…</span>
                <span className="font-bold text-[#38bdf8]">{item.score} pts</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
