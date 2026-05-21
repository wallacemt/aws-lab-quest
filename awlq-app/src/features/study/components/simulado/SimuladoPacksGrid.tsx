"use client";

import Image from "next/image";

type PackSession = {
  id: string;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
};

export type SimuladoPackListItem = {
  id: string;
  name: string;
  questionCount: number;
  artworkUrl: string | null;
  difficultyScore: number;
  createdAt: string;
  attempts: number;
  bestScore: number | null;
  lastSessionId: string | null;
  sessions: PackSession[];
};

type PacksFilter = "all" | "todo" | "done";
type DifficultyFilter = "all" | "easy" | "medium" | "hard" | "boss";
type PacksSort = "newest" | "oldest" | "name_az" | "score_desc";
type PacksView = "grid" | "list";

type Props = {
  packs: SimuladoPackListItem[];
  packsLoading: boolean;
  error: string | null;
  packsFilter: PacksFilter;
  packsDifficultyFilter: DifficultyFilter;
  packsSearch: string;
  packsSort: PacksSort;
  packsView: PacksView;
  expandedPackHistory: string | null;
  loading: boolean;
  onFilterChange: (f: PacksFilter) => void;
  onDifficultyFilterChange: (f: DifficultyFilter) => void;
  onSearchChange: (s: string) => void;
  onSortChange: (s: PacksSort) => void;
  onViewChange: (v: PacksView) => void;
  onRefresh: () => void;
  onToggleHistory: (id: string | null) => void;
  onStartPack: (packId: string, packName: string) => void;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  if (days < 30) return `há ${Math.floor(days / 7)}sem`;
  if (days < 365) return `há ${Math.floor(days / 30)}m`;
  const years = Math.floor(days / 365);
  return `há ${years} ano${years > 1 ? "s" : ""}`;
}

export function SimuladoPacksGrid({
  packs,
  packsLoading,
  error,
  packsFilter,
  packsDifficultyFilter,
  packsSearch,
  packsSort,
  packsView,
  expandedPackHistory,
  loading,
  onFilterChange,
  onDifficultyFilterChange,
  onSearchChange,
  onSortChange,
  onViewChange,
  onRefresh,
  onToggleHistory,
  onStartPack,
}: Props) {
  const search = packsSearch.trim().toLowerCase();
  const bySearch = search ? packs.filter((p) => p.name.toLowerCase().includes(search)) : packs;
  const byDifficulty = bySearch.filter((p) => {
    if (packsDifficultyFilter === "all") return true;
    if (packsDifficultyFilter === "easy") return p.difficultyScore >= 1 && p.difficultyScore <= 3;
    if (packsDifficultyFilter === "medium") return p.difficultyScore >= 4 && p.difficultyScore <= 6;
    if (packsDifficultyFilter === "hard") return p.difficultyScore >= 7 && p.difficultyScore <= 9;
    if (packsDifficultyFilter === "boss") return p.difficultyScore === 10;
    return true;
  });
  const sorted = [...byDifficulty].sort((a, b) => {
    if (packsSort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (packsSort === "name_az") return a.name.localeCompare(b.name);
    if (packsSort === "score_desc") return (b.bestScore ?? -1) - (a.bestScore ?? -1);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "todo", "done"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFilterChange(f)}
              className={[
                "border px-3 py-1 font-mono text-[10px] uppercase",
                packsFilter === f
                  ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                  : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50",
              ].join(" ")}
            >
              {f === "all" ? "Todos" : f === "todo" ? "Nao realizados" : "Realizados"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onViewChange(v)}
                title={v === "grid" ? "Grade" : "Lista"}
                className={[
                  "border px-2 py-1 font-mono text-[11px] leading-none",
                  packsView === v
                    ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                    : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50",
                ].join(" ")}
              >
                {v === "grid" ? "⊞" : "☰"}
              </button>
            ))}
            <button
              type="button"
              disabled={packsLoading}
              onClick={onRefresh}
              className="border border-[var(--pixel-border)] px-3 py-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50 disabled:opacity-40"
            >
              {packsLoading ? "..." : "↻ Atualizar"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "easy", "medium", "hard", "boss"] as const).map((df) => {
            const label =
              df === "all" ? "Todos" :
              df === "easy" ? "Facil (1–3)" :
              df === "medium" ? "Medio (4–6)" :
              df === "hard" ? "Dificil (7–9)" :
              "BOSS ⚡";
            return (
              <button
                key={df}
                type="button"
                onClick={() => onDifficultyFilterChange(df)}
                className={[
                  "border px-3 py-1 font-mono text-[10px] uppercase",
                  packsDifficultyFilter === df
                    ? df === "boss"
                      ? "border-yellow-500 text-yellow-400"
                      : "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                    : "border-[var(--pixel-border)] text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={packsSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar pack..."
            className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-1.5 font-mono text-[10px] text-[var(--pixel-text)] outline-none focus:border-[var(--pixel-primary)]/50"
          />
          <select
            value={packsSort}
            onChange={(e) => onSortChange(e.target.value as PacksSort)}
            className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] px-3 py-1.5 font-mono text-[10px] text-[var(--pixel-subtext)] outline-none"
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="name_az">Nome A-Z</option>
            <option value="score_desc">Melhor pontuacao</option>
          </select>
          {packsSearch && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:text-[var(--pixel-primary)]"
            >
              ✕ Limpar busca
            </button>
          )}
        </div>
      </div>

      {error && <p className="font-[var(--font-body)] text-sm text-red-300">{error}</p>}

      {packsLoading && (
        <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">Carregando packs...</p>
      )}

      {!packsLoading && packs.length === 0 && (
        <div className="border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-6 text-center">
          <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
            {packsFilter === "todo"
              ? "Nenhum pack pendente."
              : packsFilter === "done"
                ? "Nenhum pack realizado ainda."
                : "Nenhum pack disponivel para sua certificacao."}
          </p>
          {packsFilter === "all" && (
            <p className="mt-2 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
              Um administrador precisa gerar packs de simulado para sua certificacao.
            </p>
          )}
        </div>
      )}

      {!packsLoading && byDifficulty.length === 0 && packs.length > 0 && (
        <p className="font-mono text-xs uppercase text-[var(--pixel-subtext)]">
          Nenhum pack encontrado para os filtros selecionados.
        </p>
      )}

      <div className={packsView === "list" ? "flex flex-col gap-2" : "grid gap-3 md:grid-cols-2"}>
        {sorted.map((pack) => {
          const done = pack.attempts > 0;
          const passed = done && pack.bestScore !== null && pack.bestScore >= 70;
          const isExpanded = expandedPackHistory === pack.id;

          return (
            <div
              key={pack.id}
              className={[
                "border overflow-hidden",
                passed
                  ? "border-green-700/60 bg-green-900/10"
                  : done
                    ? "border-yellow-700/60 bg-yellow-900/10"
                    : "border-[var(--pixel-border)] bg-[var(--pixel-bg)]",
              ].join(" ")}
            >
              {packsView === "list" ? (
                /* List row layout */
                <div className="flex min-h-[5.5rem] items-stretch">
                  <div className="relative w-24 h-[88px] shrink-0 overflow-hidden border-r border-[var(--pixel-border)]">
                    {pack.artworkUrl ? (
                      <Image src={pack.artworkUrl} alt={pack.name} fill sizes="96px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-primary)]/10">
                        <span className="font-mono text-2xl font-bold text-[var(--pixel-primary)]">
                          {pack.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-bold text-[var(--pixel-primary)]">{pack.name}</p>
                        <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                          {pack.questionCount} questoes · {timeAgo(pack.createdAt)}
                          {" · "}
                          <span className={pack.difficultyScore === 10 ? "text-yellow-400" : "text-[var(--pixel-subtext)]"}>
                            {pack.difficultyScore === 10 ? "BOSS ⚡" : `${pack.difficultyScore}/10`}
                          </span>
                        </p>
                        {done && (
                          <p className="mt-0.5 font-mono text-[10px] text-[var(--pixel-subtext)]">
                            Melhor: <span className="text-[var(--pixel-text)]">{pack.bestScore}%</span>
                            {" · "}
                            Tent.: <span className="text-[var(--pixel-text)]">{pack.attempts}</span>
                          </p>
                        )}
                      </div>
                      {done && (
                        <span
                          className={[
                            "shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase",
                            passed ? "border-green-700 text-green-400" : "border-yellow-700 text-yellow-400",
                          ].join(" ")}
                        >
                          {passed ? "Aprovado" : "Reprovado"}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStartPack(pack.id, pack.name)}
                        disabled={loading}
                        className="border border-[var(--pixel-primary)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-primary)] hover:bg-[var(--pixel-primary)]/10 disabled:opacity-50"
                      >
                        {loading ? "..." : done ? "Refazer" : "Iniciar"}
                      </button>
                      {done && pack.lastSessionId && (
                        <a
                          href={`/simulado/historico/${pack.lastSessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-[var(--pixel-border)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)] hover:text-[var(--pixel-primary)]"
                        >
                          Revisar ↗
                        </a>
                      )}
                      {pack.attempts > 1 && (
                        <button
                          type="button"
                          onClick={() => onToggleHistory(isExpanded ? null : pack.id)}
                          className="border border-[var(--pixel-border)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50"
                        >
                          {isExpanded ? "Fechar" : `Hist. (${pack.attempts})`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : pack.artworkUrl ? (
                /* Game-cover layout */
                <div className="relative aspect-square w-full">
                  <Image src={pack.artworkUrl} alt={pack.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
                    <div className="flex items-end justify-between gap-2">
                      <p className="font-mono text-sm font-bold leading-tight text-primary drop-shadow">{pack.name}</p>
                      {done && (
                        <span
                          className={[
                            "shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase backdrop-blur-sm",
                            passed
                              ? "border-green-600 bg-green-900/70 text-green-300"
                              : "border-yellow-600 bg-yellow-900/70 text-yellow-300",
                          ].join(" ")}
                        >
                          {passed ? "Aprovado" : "Reprovado"}
                        </span>
                      )}
                    </div>

                    {done && (
                      <div className="flex items-center gap-3 font-mono text-[10px] text-white/70">
                        <span>Melhor: <span className="text-white">{pack.bestScore}%</span></span>
                        <span>Tentativas: <span className="text-white">{pack.attempts}</span></span>
                      </div>
                    )}

                    <p className="font-mono text-[10px] text-white/50">
                      {pack.questionCount} questoes · {timeAgo(pack.createdAt)}
                      {" · "}
                      <span className={pack.difficultyScore === 10 ? "text-yellow-400" : ""}>
                        {pack.difficultyScore === 10 ? "BOSS ⚡" : `${pack.difficultyScore}/10`}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStartPack(pack.id, pack.name)}
                        disabled={loading}
                        className="border border-white/50 bg-black/40 px-3 py-1.5 font-mono text-[10px] uppercase text-white backdrop-blur-sm hover:bg-white/10 disabled:opacity-50"
                      >
                        {loading ? "..." : done ? "Refazer" : "Iniciar"}
                      </button>
                      {done && pack.lastSessionId && (
                        <a
                          href={`/simulado/historico/${pack.lastSessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-white/30 bg-black/40 px-3 py-1.5 font-mono text-[10px] uppercase text-white/70 backdrop-blur-sm hover:text-white"
                        >
                          Revisar ultima ↗
                        </a>
                      )}
                      {pack.attempts > 1 && (
                        <button
                          type="button"
                          onClick={() => onToggleHistory(isExpanded ? null : pack.id)}
                          className="border border-white/30 bg-black/40 px-3 py-1.5 font-mono text-[10px] uppercase text-white/60 backdrop-blur-sm hover:text-white/90"
                        >
                          {isExpanded ? "Fechar" : `Historico (${pack.attempts})`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Compact layout — no artwork */
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--pixel-border)] bg-[var(--pixel-primary)]/10">
                        <span className="font-mono text-lg font-bold text-[var(--pixel-primary)]">
                          {pack.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-[var(--pixel-primary)]">{pack.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-[var(--pixel-subtext)]">
                          {pack.questionCount} questoes · {timeAgo(pack.createdAt)}
                          {" · "}
                          <span className={pack.difficultyScore === 10 ? "text-yellow-400" : ""}>
                            {pack.difficultyScore === 10 ? "BOSS ⚡" : `${pack.difficultyScore}/10`}
                          </span>
                        </p>
                      </div>
                    </div>
                    {done && (
                      <span
                        className={[
                          "shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase",
                          passed ? "border-green-700 text-green-400" : "border-yellow-700 text-yellow-400",
                        ].join(" ")}
                      >
                        {passed ? "Aprovado" : "Reprovado"}
                      </span>
                    )}
                  </div>

                  {done && (
                    <div className="flex items-center gap-4 font-mono text-[10px] text-[var(--pixel-subtext)]">
                      <span>Melhor: <span className="text-[var(--pixel-text)]">{pack.bestScore}%</span></span>
                      <span>Tentativas: <span className="text-[var(--pixel-text)]">{pack.attempts}</span></span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onStartPack(pack.id, pack.name)}
                      disabled={loading}
                      className="border border-[var(--pixel-primary)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-primary)] hover:bg-[var(--pixel-primary)]/10 disabled:opacity-50"
                    >
                      {loading ? "..." : done ? "Refazer" : "Iniciar"}
                    </button>
                    {done && pack.lastSessionId && (
                      <a
                        href={`/simulado/historico/${pack.lastSessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-[var(--pixel-border)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)] hover:text-[var(--pixel-primary)]"
                      >
                        Revisar ultima ↗
                      </a>
                    )}
                    {pack.attempts > 1 && (
                      <button
                        type="button"
                        onClick={() => onToggleHistory(isExpanded ? null : pack.id)}
                        className="border border-[var(--pixel-border)] px-3 py-1.5 font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:border-[var(--pixel-primary)]/50"
                      >
                        {isExpanded ? "Fechar" : `Historico (${pack.attempts})`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="divide-y divide-[var(--pixel-border)] border-t border-[var(--pixel-border)]">
                  {pack.sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="font-mono text-[10px] text-[var(--pixel-text)]">
                          {s.scorePercent}% — {s.correctAnswers}/{s.totalQuestions}
                        </p>
                        <p className="font-mono text-[10px] text-[var(--pixel-subtext)]">
                          {new Date(s.completedAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <a
                        href={`/simulado/historico/${s.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)] hover:text-[var(--pixel-primary)]"
                      >
                        Revisar ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
