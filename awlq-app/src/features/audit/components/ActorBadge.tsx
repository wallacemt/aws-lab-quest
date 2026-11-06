import { Bot, User } from "lucide-react";
import type { AuditActorType } from "@/features/audit/types";

export function ActorBadge({ actorType, compact = false }: { actorType: AuditActorType; compact?: boolean }) {
  const agent = actorType === "agent";
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1 border-2 px-2 font-mono text-[10px] uppercase tracking-wide ${agent ? "border-[var(--admin-actor-agent)] bg-[var(--admin-actor-agent)] text-[var(--admin-on-agent)]" : "border-[var(--admin-actor-human)] bg-transparent text-[var(--admin-actor-human)]"}`}>
      {agent ? <Bot size={12} aria-hidden="true" /> : <User size={12} aria-hidden="true" />}
      {!compact && (agent ? "AGENTE IA" : "HUMANO")}
    </span>
  );
}
