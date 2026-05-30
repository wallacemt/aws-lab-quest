"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelCard } from "@/components/ui/pixel-card";
import { authClient } from "@/lib/auth-client";

export function DataRightsScreen() {
  const router = useRouter();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/user/data-export");
      if (!res.ok) {
        throw new Error("Falha ao exportar dados.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "meus-dados.json";
      link.click();
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
      if (!res.ok) {
        throw new Error("Falha ao excluir conta.");
      }
      await authClient.signOut();
      router.replace("/login");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao excluir conta.");
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        <h1 className="font-mono text-sm uppercase text-[var(--pixel-primary)]">Privacidade e Dados</h1>

        <PixelCard className="space-y-3">
          <h2 className="font-mono text-xs uppercase text-[var(--pixel-text)]">Seus direitos (LGPD)</h2>
          <p className="font-sans text-sm text-[var(--pixel-subtext)]">
            De acordo com a Lei Geral de Protecao de Dados (LGPD), voce tem direito de acessar, corrigir, exportar e
            solicitar a exclusao dos seus dados pessoais a qualquer momento.
          </p>
          <p className="font-sans text-sm text-[var(--pixel-subtext)]">
            Canal de contato DPO:{" "}
            <a href="mailto:wallacesantanak0@gmail.com" className="font-semibold text-[var(--pixel-primary)] underline">
              wallacesantanak0@gmail.com
            </a>
          </p>
          <p className="font-sans text-sm text-[var(--pixel-subtext)]">
            Leia nossa{" "}
            <Link href="/privacidade" className="font-semibold text-[var(--pixel-primary)] underline">
              Politica de Privacidade
            </Link>{" "}
            para entender como seus dados sao tratados.
          </p>
        </PixelCard>

        <PixelCard className="space-y-3">
          <h2 className="font-mono text-xs uppercase text-[var(--pixel-text)]">Exportar meus dados</h2>
          <p className="font-sans text-sm text-[var(--pixel-subtext)]">
            Baixe uma copia completa dos seus dados em formato JSON: perfil, historico de sessoes, conquistas, badges e
            historico de labs.
          </p>
          <PixelButton onClick={handleExportData} disabled={exporting}>
            {exporting ? "Exportando..." : "Exportar meus dados"}
          </PixelButton>
        </PixelCard>

        <PixelCard className="space-y-3 border-red-800">
          <h2 className="font-mono text-xs uppercase text-red-400">Excluir minha conta</h2>
          <p className="font-sans text-sm text-[var(--pixel-subtext)]">
            Ao excluir sua conta, seus dados pessoais serao anonimizados permanentemente. Esta acao nao pode ser
            desfeita. Seu historico de atividades sera mantido de forma anonima para fins estatisticos.
          </p>
          {!deleteConfirmOpen && (
            <PixelButton
              variant="ghost"
              className="border-red-600 text-red-400"
              onClick={() => setDeleteConfirmOpen(true)}
            >
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
      </main>
    </AppLayout>
  );
}
