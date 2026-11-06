import { z } from "zod";
import type { AdminToolDef } from "./types";

const daysSchema = z.object({ days: z.number().int().optional() }).strict();
const noParams = z.object({}).strict();
const metricsPaths = [
  ["metrics_overview", "Visão geral das métricas", "Retorna contagens gerais e indicadores de atividade.", "metrics", noParams],
  ["metrics_engagement", "Métricas de engajamento", "Retorna métricas de sessões, XP e horários ativos.", "metrics/engagement", daysSchema],
  ["metrics_questions", "Métricas de questões", "Retorna métricas e questões recentes.", "metrics/questions", daysSchema],
  ["metrics_users", "Métricas de usuários", "Retorna métricas de crescimento, atividade e usuários em risco.", "metrics/users", daysSchema],
] as const;

export const METRICS_TOOLS: AdminToolDef[] = metricsPaths.map(([name, title, description, path, schema]) => ({
  name, title, description, domain: "metrics", tier: "read", method: "GET", path,
  inputSchema: schema as AdminToolDef["inputSchema"],
  ...(path === "metrics" ? {} : { queryParams: ["days"] }),
  handler: async () => {
    switch (path) {
      case "metrics": return (await import("@/app/api/admin/metrics/route")).GET as never;
      case "metrics/engagement": return (await import("@/app/api/admin/metrics/engagement/route")).GET as never;
      case "metrics/questions": return (await import("@/app/api/admin/metrics/questions/route")).GET as never;
      default: return (await import("@/app/api/admin/metrics/users/route")).GET as never;
    }
  },
}));
