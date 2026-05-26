"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminUserEditModal } from "@/features/admin/components/AdminUserEditModal";
import { fetchAdminUserDetail, AdminUserDetailPayload } from "@/features/admin/services/admin-api";
import { AdminUserListItem } from "@/features/admin/types";
import { HistoryTabs } from "@/features/study/components/history/HistoryTabs";
import { QuestHistoryItem, StudyHistoryItem } from "@/features/study/services";
import { getLevel, getLevelProgressPercent } from "@/lib/levels";

type Props = {
  userId: string;
};

export function AdminUserDetailScreen({ userId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<AdminUserDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAdminUserDetail(userId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar usuario."))
      .finally(() => setLoading(false));
  }, [userId, refreshKey]);

  if (loading) {
    return <p className="font-mono text-xs uppercase text-[#94a3b8]">Carregando...</p>;
  }

  if (error || !data) {
    return <p className="font-mono text-xs uppercase text-[#fca5a5]">{error ?? "Usuario nao encontrado."}</p>;
  }

  const { user, totalXp, currentLevel, avgScore, certBreakdown, weakAreas, strongAreas, recentSessions, recentLabs, achievements } = data;
  const progress = getLevelProgressPercent(totalXp);
  const levelInfo = getLevel(totalXp);

  const labHistory: QuestHistoryItem[] = recentLabs.map((l) => ({
    id: l.id,
    title: l.title,
    theme: l.theme,
    xp: l.xp,
    tasksCount: l.tasksCount,
    completedAt: l.completedAt,
    certification: l.certification,
    userName: l.userName,
    sourceLabText: l.sourceLabText ?? null,
    taskSnapshot: Array.isArray(l.taskSnapshot) ? (l.taskSnapshot as QuestHistoryItem["taskSnapshot"]) : [],
  }));

  const studyHistory: StudyHistoryItem[] = recentSessions.map((s) => ({
    id: s.id,
    sessionType: s.sessionType as "KC" | "SIMULADO",
    title: s.title,
    certificationCode: s.certificationCode,
    gainedXp: s.gainedXp,
    scorePercent: s.scorePercent,
    correctAnswers: s.correctAnswers,
    totalQuestions: s.totalQuestions,
    durationSeconds: s.durationSeconds,
    completedAt: s.completedAt,
    answersSnapshot: [],
    packName: s.packName,
    packArtworkUrl: s.packArtworkUrl,
  }));

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-2 border border-[#334155] px-3 py-1 text-xs uppercase text-[#94a3b8]"
          >
            ← Voltar
          </button>
          <p className="font-mono text-xs uppercase text-[#f97316]">Admin / Usuarios</p>
          <h1 className="font-mono text-sm uppercase text-[#f8fafc]">{user.name}</h1>
          <p className="text-xs text-[#94a3b8]">@{user.username} · {user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingUser(user as unknown as AdminUserListItem)}
          className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0]"
        >
          Editar usuario
        </button>
      </header>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${user.role === "admin" ? "border-[#f97316] text-[#f97316]" : "border-[#334155] text-[#94a3b8]"}`}>
          {user.role}
        </span>
        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${user.accessStatus === "approved" ? "border-[#4ade80] text-[#4ade80]" : user.accessStatus === "rejected" ? "border-[#f87171] text-[#f87171]" : "border-[#fbbf24] text-[#fbbf24]"}`}>
          {user.accessStatus}
        </span>
        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${user.active ? "border-[#4ade80] text-[#4ade80]" : "border-[#f87171] text-[#f87171]"}`}>
          {user.active ? "ativo" : "inativo"}
        </span>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total XP", value: totalXp.toLocaleString("pt-BR") },
          { label: "Labs", value: String(user.labsCompleted) },
          { label: "Sessoes", value: String(user.studySessions) },
          { label: "Score medio", value: `${avgScore}%` },
        ].map(({ label, value }) => (
          <div key={label} className="border border-[#1e293b] bg-[#111827] p-3 text-center">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">{label}</p>
            <p className="mt-1 font-mono text-lg text-[#f8fafc]">{value}</p>
          </div>
        ))}
      </div>

      {/* Level progress */}
      <div className="border border-[#1e293b] bg-[#111827] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase text-[#94a3b8]">Nivel atual</span>
          <span className="font-mono text-xs text-[#f97316]">{currentLevel.name} (Nivel {currentLevel.number})</span>
        </div>
        <div className="h-3 w-full border border-[#334155] bg-[#0b1220]">
          <div className="h-full bg-[#f97316]" style={{ width: `${progress}%` }} />
        </div>
        <p className="font-mono text-[9px] uppercase text-[#64748b]">{levelInfo.next}</p>
      </div>

      {/* Cert breakdown */}
      {certBreakdown.length > 0 && (
        <div className="border border-[#1e293b] bg-[#111827] p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Desempenho por certificacao</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1e293b] text-[#64748b]">
                <tr>
                  <th className="pb-1 pr-4 font-mono uppercase">Cert</th>
                  <th className="pb-1 pr-4 font-mono uppercase">Sessoes</th>
                  <th className="pb-1 font-mono uppercase">Score medio</th>
                </tr>
              </thead>
              <tbody>
                {certBreakdown.map((cert) => (
                  <tr key={cert.code} className="border-b border-[#1e293b] text-[#e2e8f0]">
                    <td className="py-1 pr-4 font-mono uppercase">{cert.code}</td>
                    <td className="py-1 pr-4">{cert.sessions}</td>
                    <td className={`py-1 font-mono ${cert.avgScore >= 70 ? "text-[#4ade80]" : cert.avgScore < 50 ? "text-[#f87171]" : "text-[#fbbf24]"}`}>
                      {cert.avgScore}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-[#1e293b] bg-[#111827] p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase text-[#4ade80]">Pontos fortes (score ≥ 80%)</p>
          {strongAreas.length === 0 ? (
            <p className="text-xs text-[#64748b]">Nenhum ainda.</p>
          ) : (
            <ul className="space-y-1">
              {strongAreas.map((s) => (
                <li key={s.id} className="flex items-center justify-between border border-[#1e293b] px-2 py-1">
                  <span className="text-xs text-[#e2e8f0] truncate max-w-[180px]">{s.title}</span>
                  <span className="ml-2 font-mono text-[10px] text-[#4ade80]">{s.scorePercent}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border border-[#1e293b] bg-[#111827] p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase text-[#f87171]">Pontos fracos (score &lt; 50%)</p>
          {weakAreas.length === 0 ? (
            <p className="text-xs text-[#64748b]">Nenhum ainda.</p>
          ) : (
            <ul className="space-y-1">
              {weakAreas.map((s) => (
                <li key={s.id} className="flex items-center justify-between border border-[#1e293b] px-2 py-1">
                  <span className="text-xs text-[#e2e8f0] truncate max-w-[180px]">{s.title}</span>
                  <span className="ml-2 font-mono text-[10px] text-[#f87171]">{s.scorePercent}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Achievements summary */}
      <div className="border border-[#1e293b] bg-[#111827] p-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Conquistas</p>
        <span className="font-mono text-xs text-[#f97316]">{achievements.unlockedCount} / {achievements.total}</span>
      </div>

      {/* Full history */}
      <div className="border border-[#1e293b] bg-[#111827] p-4 space-y-3">
        <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Historico de atividades</p>
        <HistoryTabs
          labHistory={labHistory}
          studyHistory={studyHistory}
          readOnly
        />
      </div>

      {editingUser && (
        <AdminUserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </main>
  );
}
