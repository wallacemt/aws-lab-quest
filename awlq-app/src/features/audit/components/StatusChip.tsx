import { Check, Gauge, Hourglass, ShieldX, X } from "lucide-react";
import type { AuditStatus } from "@/features/audit/types";

const config = {
  ok: { label: "OK", color: "var(--admin-status-ok)", Icon: Check },
  error: { label: "ERRO", color: "var(--admin-status-error)", Icon: X },
  denied: { label: "NEGADO", color: "var(--admin-status-warn)", Icon: ShieldX },
  rate_limited: { label: "LIMITE", color: "var(--admin-status-warn)", Icon: Gauge },
  pending: { label: "PENDENTE", color: "var(--admin-status-neutral)", Icon: Hourglass },
} satisfies Record<AuditStatus, { label: string; color: string; Icon: typeof Check }>;

export function StatusChip({ status }: { status: AuditStatus }) {
  const { label, color, Icon } = config[status];
  return <span className={`inline-flex h-6 items-center gap-1 border-2 px-1.5 font-mono text-[10px] uppercase tracking-wide ${status === "pending" ? "border-dashed" : ""}`} style={{ color, borderColor: color }}><Icon size={12} aria-hidden="true" />{label}</span>;
}
