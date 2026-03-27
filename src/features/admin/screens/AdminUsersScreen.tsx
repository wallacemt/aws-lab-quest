"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveAdminUser,
  deactivateAdminUser,
  listAdminUsers,
  rejectAdminUser,
  updateAdminUser,
} from "@/features/admin/services/admin-api";
import { AdminUserListItem, PaginatedResult } from "@/features/admin/types";
import { EditIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CertificationOption = {
  id: string;
  code: string;
  name: string;
};

export function AdminUsersScreen() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [accessStatus, setAccessStatus] = useState<"" | "pending" | "approved" | "rejected">("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [certificationCode, setCertificationCode] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "lastSeen" | "name" | "email" | "role">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PaginatedResult<AdminUserListItem> | null>(null);
  const [certifications, setCertifications] = useState<CertificationOption[]>([]);

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
    void loadUsers();
  }, [loadUsers]);

  async function handleApprove(userId: string) {
    setBusyUserId(userId);
    setGlobalMessage(null);
    try {
      await approveAdminUser(userId);
      setGlobalMessage("Usuario aprovado com sucesso.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aprovar usuario.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleReject(userId: string) {
    const reason = window.prompt("Motivo da recusa (opcional):", "");
    setBusyUserId(userId);
    setGlobalMessage(null);
    try {
      await rejectAdminUser(userId, reason ?? undefined);
      setGlobalMessage("Usuario recusado.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao recusar usuario.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleEdit(item: AdminUserListItem) {
    const name = window.prompt("Nome do usuario:", item.name);
    if (!name || !name.trim()) {
      return;
    }

    setBusyUserId(item.id);
    try {
      await updateAdminUser(item.id, { name: name.trim() });
      setGlobalMessage("Usuario atualizado.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar usuario.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleToggleRole(item: AdminUserListItem) {
    const nextRole = item.role === "admin" ? "user" : "admin";
    setBusyUserId(item.id);
    try {
      await updateAdminUser(item.id, { role: nextRole });
      setGlobalMessage(`Role atualizada para ${nextRole}.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar role.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDeactivate(userId: string) {
    if (!window.confirm("Deseja desativar este usuario?")) {
      return;
    }

    setBusyUserId(userId);
    try {
      await deactivateAdminUser(userId);
      setGlobalMessage("Usuario desativado.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desativar usuario.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <main className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase text-[#f97316]">Usuarios</p>
        <h1 className="font-mono text-sm uppercase text-[#f8fafc]">Listagem de usuarios</h1>
        <button
          type="button"
          onClick={() => void loadUsers()}
          className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#e2e8f0]"
        >
          Atualizar dados
        </button>
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
            value={accessStatus}
            onChange={(event) => {
              setPage(1);
              setAccessStatus(event.target.value as "" | "pending" | "approved" | "rejected");
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Todos os status</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>

          <select
            value={active}
            onChange={(event) => {
              setPage(1);
              setActive(event.target.value as "" | "true" | "false");
            }}
            className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm text-[#e2e8f0] outline-none"
          >
            <option value="">Ativos e inativos</option>
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
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
        </div>
      </section>

      {loading && <p className="text-sm text-[#94a3b8]">Carregando usuarios...</p>}
      {error && <p className="text-sm text-[#fca5a5]">{error}</p>}
      {globalMessage && <p className="text-sm text-[#86efac]">{globalMessage}</p>}

      {!loading && result && (
        <>
          <section className="overflow-x-auto border border-[#1e293b] bg-[#111827]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#1e293b] bg-[#0f172a] text-xs uppercase text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2">Labs</th>
                  <th className="px-3 py-2">Estudos</th>
                  <th className="px-3 py-2">Ultimo acesso</th>
                  <th className="px-3 py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b border-[#1e293b] text-[#e2e8f0]">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">{item.email}</td>
                    <td className="px-3 py-2 uppercase">{item.role}</td>
                    <td className="px-3 py-2 uppercase">{item.accessStatus}</td>
                    <td className="px-3 py-2 uppercase">{item.active ? "sim" : "nao"}</td>
                    <td className="px-3 py-2">{item._count.questHistory}</td>
                    <td className="px-3 py-2">{item._count.studyHistory}</td>
                    <td className="px-3 py-2">{new Date(item.lastSeen).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          className="flex items-center justify-center hover:border-[var(--pixel-primary)]"
                        >
                          <div className="h-12 w-12 overflow-hidden border-4 border-[var(--pixel-border)] shadow-[4px_4px_0_0_var(--pixel-shadow)] rounded-full">
                            <EditIcon />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-45 font-mono flex flex-col items-center justify-center bg-pixel-shadow retro-border border-2 rounded-lg"
                        >
                          <DropdownMenuGroup className="space-y-1">
                            <DropdownMenuItem onClick={() => void handleEdit(item)} disabled={busyUserId === item.id}>
                              <div className="border border-[#334155] px-2 py-1 text-[10px] uppercase disabled:opacity-40 rounded-md">
                                Editar
                              </div>
                            </DropdownMenuItem>

                            <DropdownMenuGroup className="mt-2 space-y-1">
                              <DropdownMenuItem
                                onClick={() => void handleApprove(item.id)}
                                disabled={busyUserId === item.id || item.accessStatus === "approved"}
                              >
                                <div className="border border-[#14532d] px-2 py-1 text-[10px] uppercase disabled:opacity-40 rounded-md">
                                  Aprovar
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void handleReject(item.id)}
                                disabled={busyUserId === item.id}
                              >
                                <div className="border border-[#7f1d1d] px-2 py-1 text-[10px] uppercase disabled:opacity-40 rounded-md">
                                  Recusar
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuGroup>

                            <DropdownMenuGroup className="mt-2 space-y-1">
                              <DropdownMenuItem
                                onClick={() => void handleToggleRole(item)}
                                disabled={busyUserId === item.id}
                              >
                                <div className="border border-[#1d4ed8] px-2 py-1 text-[10px] uppercase disabled:opacity-40 rounded-md">
                                  Alterar role
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void handleDeactivate(item.id)}
                                disabled={busyUserId === item.id || !item.active}
                              >
                                <div className="border border-[#9a3412] px-2 py-1 text-[10px] uppercase disabled:opacity-40 rounded-md">
                                  Desativar
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
    </main>
  );
}
