"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listAdminUsers } from "@/features/admin/services/admin-api";
import { AdminUserEditModal } from "@/features/admin/components/AdminUserEditModal";
import { AdminUserListItem, CertificationOption, PaginatedResult } from "@/features/admin/types";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
}

export function AdminUsersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [accessStatus, setAccessStatus] = useState<"" | "pending" | "approved" | "rejected">("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [certificationCode, setCertificationCode] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"createdAt" | "lastSeen" | "name" | "email" | "role">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PaginatedResult<AdminUserListItem> | null>(null);
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [autoApproveLoading, setAutoApproveLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminUsers({
        page,
        pageSize: 10,
        search,
        role,
        accessStatus: accessStatus || undefined,
        active: active || undefined,
        certificationCode,
        sortBy,
        sortOrder,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar usuarios.");
    } finally {
      setLoading(false);
    }
  }, [page, search, role, accessStatus, active, certificationCode, sortBy, sortOrder]);

  useEffect(() => {
    async function loadCertifications() {
      try {
        const response = await fetch("/api/certifications", { method: "GET", cache: "no-store", credentials: "include" });
        if (!response.ok) return;
        const payload = (await response.json()) as { certifications?: CertificationOption[] };
        setCertifications(payload.certifications ?? []);
      } catch {
        // Keep table usable without certification options.
      }
    }

    async function loadAutoApprove() {
      try {
        const res = await fetch("/api/admin/config", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { autoApproveUsers: boolean };
        setAutoApprove(json.autoApproveUsers);
      } catch {
        // Non-fatal
      }
    }

    void loadCertifications();
    void loadAutoApprove();
  }, []);

  async function handleToggleAutoApprove() {
    if (autoApprove === null) return;
    setAutoApproveLoading(true);
    const next = !autoApprove;
    setAutoApprove(next);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ autoApproveUsers: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setAutoApprove(!next);
    } finally {
      setAutoApproveLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function statusBadge(status: AdminUserListItem["accessStatus"]) {
    const map = {
      approved: "border-[#14532d] bg-green-900/20 text-green-300",
      rejected: "border-[#7f1d1d] bg-red-900/20 text-red-300",
      pending: "border-yellow-600 bg-yellow-900/20 text-yellow-300",
    };
    return (
      <span className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${map[status]}`}>{status}</span>
    );
  }

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Usuarios</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Gerenciamento de usuarios</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0]"
          >
            Atualizar dados
          </button>
          {result && (() => {
            const onlineCount = result.items.filter((u) => isOnline(u.lastSeen)).length;
            return onlineCount > 0 ? (
              <span className="flex items-center gap-1.5 border border-green-700 bg-green-900/20 px-2 py-1 font-mono text-[10px] uppercase text-green-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                </span>
                {onlineCount} online agora
              </span>
            ) : null;
          })()}
          {autoApprove !== null && (
            <button
              type="button"
              onClick={() => void handleToggleAutoApprove()}
              disabled={autoApproveLoading}
              className={`flex items-center gap-2 rounded px-3 py-1 font-mono text-xs uppercase transition-colors ${
                autoApprove
                  ? "bg-green-900/60 text-green-300 hover:bg-red-900/60 hover:text-red-300"
                  : "bg-[#1e293b] text-[#64748b] hover:bg-green-900/60 hover:text-green-300"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${autoApprove ? "bg-green-400" : "bg-[#475569]"}`} />
              Auto-aprovar novos usuarios: {autoApprove ? "Ativo" : "Inativo"}
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <section className="border border-[#1e293b] bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Buscar por nome, username ou email"
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          />
          <select
            value={role}
            onChange={(e) => { setPage(1); setRole(e.target.value); }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todas as roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <select
            value={accessStatus}
            onChange={(e) => { setPage(1); setAccessStatus(e.target.value as typeof accessStatus); }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todos os status</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
          <select
            value={active}
            onChange={(e) => { setPage(1); setActive(e.target.value as typeof active); }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Ativos e inativos</option>
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
          </select>
          <select
            value={certificationCode}
            onChange={(e) => { setPage(1); setCertificationCode(e.target.value); }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todas as certificacoes</option>
            {certifications.map((c) => (
              <option key={c.id} value={c.code}>{c.code}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(e) => { setPage(1); setSortBy(e.target.value as typeof sortBy); }}
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
              onChange={(e) => { setPage(1); setSortOrder(e.target.value as "asc" | "desc"); }}
              className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[#94a3b8]">
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(e) => { setPage(1); setOnlineOnly(e.target.checked); }}
              className="accent-green-400"
            />
            Apenas online (5 min)
          </label>
        </div>
      </section>

      {loading && <p className="text-sm text-[#94a3b8]">Carregando usuarios...</p>}
      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}
      {globalMessage && <p className="text-sm text-[#86efac]">{globalMessage}</p>}

      {!loading && result && (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2 text-center">Online</th>
                  <th className="px-3 py-2">Labs</th>
                  <th className="px-3 py-2">Estudos</th>
                  <th className="px-3 py-2">Ultimo acesso</th>
                  <th className="px-3 py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {result.items.filter((u) => !onlineOnly || isOnline(u.lastSeen)).map((item) => (
                  <tr key={item.id} className="border-b border-[#1e293b] text-[#e2e8f0] hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <div>
                        <p className="text-sm">{item.name}</p>
                        {item.username && (
                          <p className="text-xs text-[#64748b]">@{item.username}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#94a3b8]">{item.email}</td>
                    <td className="px-3 py-2">
                      <span className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                        item.role === "admin"
                          ? "border-[#1d4ed8] bg-blue-900/20 text-blue-300"
                          : "border-[#334155] text-[#64748b]"
                      }`}>
                        {item.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">{statusBadge(item.accessStatus)}</td>
                    <td className="px-3 py-2">
                      <span className={`border px-1.5 py-0.5 font-mono text-[10px] ${
                        item.active
                          ? "border-[#14532d] bg-green-900/20 text-green-400"
                          : "border-[#7f1d1d] bg-red-900/20 text-red-400"
                      }`}>
                        {item.active ? "sim" : "nao"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isOnline(item.lastSeen) ? (
                        <span className="relative flex h-2.5 w-2.5 mx-auto">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
                        </span>
                      ) : (
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#334155]" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{item._count.questHistory}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{item._count.studyHistory}</td>
                    <td className="px-3 py-2 text-xs text-[#64748b]">
                      {new Date(item.lastSeen).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/users/${item.id}`)}
                        className="border border-[#334155] px-3 py-1 font-mono text-[10px] uppercase text-[#94a3b8] transition-colors hover:border-[#f97316] hover:text-[#f97316]"
                      >
                        Detalhes
                      </button>
                    </td>
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

      <AdminUserEditModal
        user={editingUser}
        certificationOptions={certifications}
        onClose={() => setEditingUser(null)}
        onSaved={() => {
          setGlobalMessage("Usuario atualizado com sucesso.");
          void loadUsers();
        }}
      />
    </main>
  );
}
