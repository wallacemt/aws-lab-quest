"use client";

import { useEffect, useState } from "react";
import { setAdminUserPassword, updateAdminUser } from "@/features/admin/services/admin-api";
import { AdminUserListItem, CertificationOption } from "@/features/admin/types";

type Props = {
  user: AdminUserListItem | null;
  certificationOptions: CertificationOption[];
  onClose: () => void;
  onSaved: () => void;
};

type AccessStatus = "pending" | "approved" | "rejected";

export function AdminUserEditModal({ user, certificationOptions, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("user");
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("pending");
  const [accessDecisionReason, setAccessDecisionReason] = useState("");
  const [active, setActive] = useState(true);
  const [certificationPresetId, setCertificationPresetId] = useState<string>("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setUsername(user.username ?? "");
    setRole(user.role);
    setAccessStatus(user.accessStatus);
    setAccessDecisionReason(user.accessDecisionReason ?? "");
    setActive(user.active);
    setCertificationPresetId(user.profile?.certificationPresetId ?? "");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setPasswordError(null);
    setSuccessMessage(null);
  }, [user]);

  if (!user) return null;

  async function handleSave() {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      await updateAdminUser(user.id, {
        name: name.trim() || undefined,
        username: username.trim() || undefined,
        role,
        accessStatus,
        accessDecisionReason: accessDecisionReason.trim() || undefined,
        active,
        certificationPresetId: certificationPresetId || null,
      });
      setSuccessMessage("Alteracoes salvas com sucesso.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar alteracoes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPassword() {
    if (!user) return;
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Senha deve ter no minimo 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas nao coincidem.");
      return;
    }
    setSavingPassword(true);
    try {
      await setAdminUserPassword(user.id, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Senha definida com sucesso.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Falha ao definir senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  const statusColors: Record<AccessStatus, string> = {
    pending: "border-yellow-500 bg-yellow-900/30 text-yellow-300",
    approved: "border-[#14532d] bg-green-900/30 text-green-300",
    rejected: "border-[#7f1d1d] bg-red-900/30 text-red-300",
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded border border-[#334155] bg-[#111827] text-[#e2e8f0]">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#1e293b] px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase text-[#f97316]">Gerenciar usuario</p>
            <h2 className="mt-1 text-base font-semibold text-[#f8fafc]">{user.name}</h2>
            <p className="text-xs text-[#64748b]">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[#334155] px-3 py-1 text-xs uppercase text-[#94a3b8] hover:text-[#e2e8f0]"
          >
            Fechar
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">

          {successMessage && (
            <p className="border border-[#14532d] bg-green-900/20 px-3 py-2 text-xs text-green-300">{successMessage}</p>
          )}
          {error && (
            <p className="border border-[#7f1d1d] bg-red-900/20 px-3 py-2 text-xs text-[#fca5a5]">{error}</p>
          )}

          {/* Identity */}
          <section className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Identidade</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Nome</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@usuario"
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Email</span>
                <input
                  type="text"
                  value={user.email}
                  disabled
                  className="w-full border border-[#1e293b] bg-[#0b1220] px-3 py-2 text-sm text-[#475569]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Certificacao alvo</span>
                <select
                  value={certificationPresetId}
                  onChange={(e) => setCertificationPresetId(e.target.value)}
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm"
                >
                  <option value="">Nenhuma</option>
                  {certificationOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* Access */}
          <section className="space-y-3">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Acesso</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Role</span>
                <div className="flex gap-2">
                  {(["user", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 border px-3 py-1.5 text-xs uppercase transition-colors ${
                        role === r
                          ? "border-[#1d4ed8] bg-blue-900/30 text-blue-300"
                          : "border-[#334155] text-[#64748b] hover:text-[#e2e8f0]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Conta ativa</span>
                <div className="flex gap-2">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setActive(v)}
                      className={`flex-1 border px-3 py-1.5 text-xs uppercase transition-colors ${
                        active === v
                          ? v
                            ? "border-[#14532d] bg-green-900/30 text-green-300"
                            : "border-[#9a3412] bg-red-900/30 text-red-300"
                          : "border-[#334155] text-[#64748b] hover:text-[#e2e8f0]"
                      }`}
                    >
                      {v ? "Ativa" : "Inativa"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase text-[#64748b]">Status de acesso</span>
              <div className="flex gap-2">
                {(["pending", "approved", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAccessStatus(s)}
                    className={`flex-1 border px-3 py-1.5 text-xs uppercase transition-colors ${
                      accessStatus === s ? statusColors[s] : "border-[#334155] text-[#64748b] hover:text-[#e2e8f0]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {(accessStatus === "rejected" || accessStatus === "approved") && (
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Motivo / observacao</span>
                <input
                  type="text"
                  value={accessDecisionReason}
                  onChange={(e) => setAccessDecisionReason(e.target.value)}
                  placeholder="Motivo da decisao (opcional)"
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                />
              </label>
            )}
          </section>

          {/* Stats — read-only */}
          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Atividade</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Labs", value: user._count.questHistory },
                { label: "Estudos", value: user._count.studyHistory },
                { label: "Membro desde", value: new Date(user.createdAt).toLocaleDateString("pt-BR") },
                { label: "Ultimo acesso", value: new Date(user.lastSeen).toLocaleDateString("pt-BR") },
              ].map((stat) => (
                <div key={stat.label} className="border border-[#1e293b] bg-[#0b1220] p-2 text-center">
                  <p className="font-mono text-xs text-[#f8fafc]">{stat.value}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-[#475569]">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Password */}
          <section className="space-y-3 border-t border-[#1e293b] pt-5">
            <p className="font-mono text-[10px] uppercase text-[#94a3b8]">Definir nova senha</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Nova senha</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres"
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs uppercase text-[#64748b]">Confirmar senha</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full border border-[#334155] bg-[#0b1220] px-3 py-2 text-sm placeholder:text-[#475569]"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[#64748b]">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Mostrar senha
              </label>
              {passwordError && <p className="text-xs text-[#fca5a5]">{passwordError}</p>}
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => void handleSetPassword()}
                  disabled={savingPassword || !newPassword}
                  className="border border-[#334155] px-4 py-1.5 text-xs uppercase disabled:opacity-40 hover:border-[#475569]"
                >
                  {savingPassword ? "Salvando..." : "Definir senha"}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#1e293b] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#334155] px-4 py-2 text-xs uppercase text-[#94a3b8] hover:text-[#e2e8f0]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="border border-[#1d4ed8] bg-blue-900/20 px-4 py-2 text-xs uppercase text-blue-300 disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar alteracoes"}
          </button>
        </div>
      </div>
    </div>
  );
}
