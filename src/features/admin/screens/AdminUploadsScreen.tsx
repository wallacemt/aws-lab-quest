"use client";

import { useEffect, useState } from "react";
import { getAdminUploadSignedUrl, listAdminUploads } from "@/features/admin/services/admin-api";
import { AdminUploadedFileItem, AdminUploadJobItem, AdminUploadType } from "@/features/admin/types";

type CertificationOption = {
  id: string;
  code: string;
  name: string;
};

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

export function AdminUploadsScreen() {
  const [search, setSearch] = useState("");
  const [uploadType, setUploadType] = useState<AdminUploadType | "">("");
  const [certificationCode, setCertificationCode] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [files, setFiles] = useState<AdminUploadedFileItem[]>([]);
  const [recentJobs, setRecentJobs] = useState<AdminUploadJobItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);

  useEffect(() => {
    async function loadCertifications() {
      try {
        const response = await fetch("/api/certifications", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { certifications?: CertificationOption[] };
        setCertifications(payload.certifications ?? []);
      } catch {
        // Keep screen usable without certification list.
      }
    }

    void loadCertifications();
  }, []);

  useEffect(() => {
    async function loadUploads() {
      setLoading(true);
      setError(null);

      try {
        const payload = await listAdminUploads({
          page,
          pageSize: 10,
          limit: 8,
          search,
          uploadType,
          certificationCode,
        });

        setFiles(payload.files);
        setRecentJobs(payload.recentJobs);
        setPagination(payload.filesPagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar historico de uploads.");
      } finally {
        setLoading(false);
      }
    }

    void loadUploads();
  }, [page, search, uploadType, certificationCode]);

  async function handleOpenFile(fileId: string) {
    setDownloadingId(fileId);
    setError(null);

    try {
      const payload = await getAdminUploadSignedUrl(fileId, 180);
      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao abrir arquivo.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Uploads</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Historico de arquivos enviados</h1>
      </header>

      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Buscar por arquivo, hash, caminho ou certificacao"
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />

          <select
            value={uploadType}
            onChange={(event) => {
              setPage(1);
              setUploadType(event.target.value as AdminUploadType | "");
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todos os tipos</option>
            <option value="EXAM_GUIDE">EXAM_GUIDE</option>
            <option value="SIMULADO_PDF">SIMULADO_PDF</option>
            <option value="SIMULADO_GENERATION">SIMULADO_GENERATION</option>
          </select>

          <select
            value={certificationCode}
            onChange={(event) => {
              setPage(1);
              setCertificationCode(event.target.value);
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todas as certificacoes</option>
            {certifications.map((certification) => (
              <option key={certification.id} value={certification.code}>
                {certification.code} - {certification.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading && <p className="text-sm text-[#94a3b8]">Carregando uploads...</p>}
      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

      {!loading && (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Arquivo</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Certificacao</th>
                  <th className="px-3 py-2">Tamanho</th>
                  <th className="px-3 py-2">Enviado por</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {files.length === 0 && (
                  <tr className="border-b border-[#1e293b] text-[#94a3b8]">
                    <td colSpan={7} className="px-3 py-4">
                      Nenhum arquivo encontrado para os filtros aplicados.
                    </td>
                  </tr>
                )}
                {files.map((file) => (
                  <tr key={file.id} className="border-b border-[#1e293b] text-[#e2e8f0]">
                    <td className="px-3 py-2">
                      <p>{file.fileName}</p>
                      <p className="text-xs text-[#94a3b8]">{file.storagePath}</p>
                    </td>
                    <td className="px-3 py-2 uppercase">{file.uploadType}</td>
                    <td className="px-3 py-2">{file.certificationPreset?.code ?? "-"}</td>
                    <td className="px-3 py-2">{formatBytes(file.fileSizeBytes)}</td>
                    <td className="px-3 py-2">{file.uploadedBy?.name ?? file.uploadedBy?.email ?? "-"}</td>
                    <td className="px-3 py-2">{formatDate(file.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleOpenFile(file.id);
                        }}
                        disabled={downloadingId === file.id}
                        className="border border-[#334155] px-2 py-1 text-xs uppercase disabled:opacity-50"
                      >
                        {downloadingId === file.id ? "Abrindo..." : "Abrir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
            <span>
              Pagina {pagination.page} de {pagination.totalPages} | Total: {pagination.total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          </footer>

          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <div className="border-b border-[#1e293b] bg-[#0f172a] px-3 py-2 text-xs uppercase text-[#94a3b8]">
              Jobs recentes
            </div>
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-[#1e293b] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Certificacao</th>
                  <th className="px-3 py-2">Geradas/Salvas</th>
                  <th className="px-3 py-2">Atualizacao</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.length === 0 && (
                  <tr className="border-b border-[#1e293b] text-[#94a3b8]">
                    <td colSpan={6} className="px-3 py-4">
                      Nenhum job recente.
                    </td>
                  </tr>
                )}
                {recentJobs.map((job) => (
                  <tr key={job.id} className="border-b border-[#1e293b] text-[#e2e8f0]">
                    <td className="px-3 py-2">{job.id.slice(0, 8)}</td>
                    <td className="px-3 py-2 uppercase">{job.uploadType}</td>
                    <td className="px-3 py-2 uppercase">
                      {job.status} ({job.progressPercent}%)
                    </td>
                    <td className="px-3 py-2">{job.certificationPreset?.code ?? "-"}</td>
                    <td className="px-3 py-2">
                      {(job.generatedCount ?? 0).toString()} / {(job.savedCount ?? 0).toString()}
                    </td>
                    <td className="px-3 py-2">{formatDate(job.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
