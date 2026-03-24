"use client";

import { useEffect, useState } from "react";
import { listAdminUsers } from "@/features/admin/services/admin-api";
import { AdminUserListItem, PaginatedResult } from "@/features/admin/types";

type CertificationOption = {
  id: string;
  code: string;
  name: string;
};

export function AdminUsersScreen() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [certificationCode, setCertificationCode] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [lastSeenFrom, setLastSeenFrom] = useState("");
  const [lastSeenTo, setLastSeenTo] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "lastSeen" | "name" | "email" | "role">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaginatedResult<AdminUserListItem> | null>(null);
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
        // Keep table usable without certification options.
      }
    }

    void loadCertifications();
  }, []);

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      setError(null);

      try {
        const data = await listAdminUsers({
          page,
          pageSize: 10,
          search,
          role,
          certificationCode,
          createdFrom,
          createdTo,
          lastSeenFrom,
          lastSeenTo,
          sortBy,
          sortOrder,
        });
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar usuarios.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [page, search, role, certificationCode, createdFrom, createdTo, lastSeenFrom, lastSeenTo, sortBy, sortOrder]);

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Usuarios</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Listagem de usuarios</h1>
      </header>

      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Buscar por nome, username ou email"
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />

          <select
            value={role}
            onChange={(event) => {
              setPage(1);
              setRole(event.target.value);
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todas as roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
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
                {certification.code}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(event) => {
                setPage(1);
                setSortBy(event.target.value as "createdAt" | "lastSeen" | "name" | "email" | "role");
              }}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            >
              <option value="createdAt">Cadastro</option>
              <option value="lastSeen">Ultimo acesso</option>
              <option value="name">Nome</option>
              <option value="email">Email</option>
              <option value="role">Role</option>
            </select>
            <select
              value={sortOrder}
              onChange={(event) => {
                setPage(1);
                setSortOrder(event.target.value as "asc" | "desc");
              }}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <input
            type="date"
            value={createdFrom}
            onChange={(event) => {
              setPage(1);
              setCreatedFrom(event.target.value);
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />

          <input
            type="date"
            value={createdTo}
            onChange={(event) => {
              setPage(1);
              setCreatedTo(event.target.value);
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />

          <input
            type="date"
            value={lastSeenFrom}
            onChange={(event) => {
              setPage(1);
              setLastSeenFrom(event.target.value);
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />

          <input
            type="date"
            value={lastSeenTo}
            onChange={(event) => {
              setPage(1);
              setLastSeenTo(event.target.value);
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />
        </div>
      </section>

      {loading && <p className="text-sm text-[#94a3b8]">Carregando usuarios...</p>}
      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}

      {!loading && result && (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Labs</th>
                  <th className="px-3 py-2">Estudos</th>
                  <th className="px-3 py-2">Ultimo acesso</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b border-[#1e293b] text-[#e2e8f0]">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">{item.email}</td>
                    <td className="px-3 py-2 uppercase">{item.role}</td>
                    <td className="px-3 py-2">{item._count.questHistory}</td>
                    <td className="px-3 py-2">{item._count.studyHistory}</td>
                    <td className="px-3 py-2">{new Date(item.lastSeen).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="flex items-center justify-between border border-[#1e293b] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
            <span>
              Pagina {result.page} de {result.totalPages} | Total: {result.total}
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
                disabled={page >= result.totalPages}
                onClick={() => setPage((prev) => Math.min(result.totalPages, prev + 1))}
                className="border border-[#334155] px-3 py-1 text-xs uppercase disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
