"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { authClient } from "@/lib/auth-client";

export function PrivacyTab() {
  const router = useRouter();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data: { leaderboardVisible?: boolean }) => {
        if (typeof data.leaderboardVisible === "boolean") {
          setLeaderboardVisible(data.leaderboardVisible);
        }
      })
      .catch(() => void 0);
  }, []);

  async function handleToggleLeaderboard(visible: boolean) {
    setSavingVisibility(true);
    try {
      await fetch("/api/user/privacy-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderboardVisible: visible }),
      });
      setLeaderboardVisible(visible);
    } finally {
      setSavingVisibility(false);
    }
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/user/data-export");
      if (!res.ok) throw new Error("Falha ao exportar dados.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meus-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Nao foi possivel exportar seus dados. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir conta.");
      await authClient.signOut();
      router.replace("/login");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao excluir conta.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PixelCard className="space-y-3">
        <h3 className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Seus direitos (LGPD)</h3>
        <p className="font-sans text-sm text-[var(--pixel-subtext)]">
          Canal de contato:{" "}
          <a
            href="mailto:wallacesantanak0@gmail.com"
            className="font-semibold text-[var(--pixel-primary)] underline"
          >
            wallacesantanak0@gmail.com
          </a>
        </p>
        <p className="font-sans text-sm text-[var(--pixel-subtext)]">
          <Link href="/privacidade" className="font-semibold text-[var(--pixel-primary)] underline">
            Politica de Privacidade
          </Link>
        </p>
      </PixelCard>

      <PixelCard className="space-y-3">
        <h3 className="font-mono text-xs uppercase text-[var(--pixel-text)]">Ranking publico</h3>
        <p className="font-sans text-sm text-[var(--pixel-subtext)]">
          Controle se voce aparece no ranking publico e nas buscas de jogadores.
        </p>
        <label className="flex cursor-pointer items-center gap-3">
          <div
            role="switch"
            aria-checked={leaderboardVisible}
            onClick={() => !savingVisibility && handleToggleLeaderboard(!leaderboardVisible)}
            className={`relative h-6 w-11 cursor-pointer rounded-full border-2 border-[var(--pixel-border)] transition-colors ${
              leaderboardVisible ? "bg-[var(--pixel-primary)]" : "bg-[var(--pixel-muted)]"
            } ${savingVisibility ? "opacity-50" : ""}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                leaderboardVisible ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="font-sans text-sm text-[var(--pixel-text)]">
            {leaderboardVisible ? "Aparecer no ranking publico" : "Oculto do ranking publico"}
          </span>
        </label>
      </PixelCard>

      <PixelCard className="space-y-3">
        <h3 className="font-mono text-xs uppercase text-[var(--pixel-text)]">Exportar meus dados</h3>
        <p className="font-sans text-sm text-[var(--pixel-subtext)]">
          Baixe uma copia de todos os seus dados pessoais em formato JSON.
        </p>
        <PixelButton onClick={handleExportData} disabled={exporting}>
          {exporting ? "Exportando..." : "Exportar meus dados"}
        </PixelButton>
      </PixelCard>

      <PixelCard className="space-y-3 border-red-800">
        <h3 className="font-mono text-xs uppercase text-red-400">Excluir minha conta</h3>
        <p className="font-sans text-sm text-[var(--pixel-subtext)]">
          Seus dados pessoais serao anonimizados permanentemente. Esta acao e irreversivel.
        </p>
        {!deleteConfirmOpen && (
          <PixelButton variant="ghost" className="border-red-600 text-red-400" onClick={() => setDeleteConfirmOpen(true)}>
            Excluir minha conta
          </PixelButton>
        )}
        {deleteConfirmOpen && (
          <div className="space-y-3 border-2 border-red-700 bg-red-900/20 p-4">
            <p className="font-mono text-[10px] uppercase text-red-300">
              Tem certeza? Esta acao e permanente e irreversivel.
            </p>
            {deleteError && <p className="font-sans text-sm text-red-300">{deleteError}</p>}
            <div className="flex gap-3">
              <PixelButton
                variant="ghost"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
              >
                Cancelar
              </PixelButton>
              <PixelButton
                className="border-red-600 bg-red-900/40 text-red-300"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? "Excluindo..." : "Confirmar exclusao"}
              </PixelButton>
            </div>
          </div>
        )}
      </PixelCard>
    </div>
  );
}
