"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelCard } from "@/components/ui/pixel-card";
import { PixelButton } from "@/components/ui/pixel-button";
import { getAdminStatus } from "@/features/admin/services/admin-api";
import { AdminStatus } from "@/features/admin/types";

export function AdminDashboardScreen() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const data = await getAdminStatus();
        setStatus(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao validar acesso admin.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <PixelCard className="space-y-3">
        <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">Admin</p>
        <h1 className="font-[var(--font-pixel)] text-sm uppercase leading-6 text-[var(--pixel-primary)] sm:text-base">
          Painel de ingestao de questoes
        </h1>
        <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
          Esta area vai centralizar upload de PDF, OCR, transformacao via IA e revisao antes de salvar no banco.
        </p>
      </PixelCard>

      {loading && (
        <PixelCard>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Validando acesso admin...
          </p>
        </PixelCard>
      )}

      {!loading && error && (
        <PixelCard className="space-y-3 border-[var(--pixel-danger)] bg-[var(--pixel-danger)]/10">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-danger)]">Acesso negado</p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">{error}</p>
          <div>
            <Link href="/">
              <PixelButton>Voltar para home</PixelButton>
            </Link>
          </div>
        </PixelCard>
      )}

      {!loading && !error && status && (
        <PixelCard className="space-y-3">
          <p className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-primary)]">
            Acesso autorizado
          </p>
          <p className="font-[var(--font-body)] text-sm leading-6 text-[var(--pixel-text)]">
            Sessao validada para {status.admin.email}. Proximos passos: upload de PDF, pipeline OCR e revisao.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/upload">
              <PixelButton>Upload de PDF</PixelButton>
            </Link>
            <Link href="/admin/users">
              <PixelButton variant="ghost">Listar usuarios</PixelButton>
            </Link>
            <Link href="/admin/questions">
              <PixelButton variant="ghost">Banco de questoes</PixelButton>
            </Link>
          </div>
        </PixelCard>
      )}
    </main>
  );
}
