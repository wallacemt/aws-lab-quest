import { z } from "zod";
import type { AdminToolDef } from "./types";

const fileIdSchema = z.object({ fileId: z.string().min(1) }).strict();
const jobIdSchema = z.object({ jobId: z.string().min(1) }).strict();
const uploadsListSchema = z.object({
  limit: z.number().int().positive().max(100).optional(), page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(50).optional(), search: z.string().optional(),
  uploadType: z.enum(["EXAM_GUIDE", "SIMULADO_PDF", "SIMULADO_GENERATION"]).optional(), certificationCode: z.string().optional(),
}).strict();
const uploadQuestionsSchema = z.object({ fileId: z.string().min(1), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(50).optional() }).strict();
const sourceCreateSchema = z.object({ displayName: z.string().min(1), url: z.string().url(), certificationPresetId: z.string().optional() }).strict();
const sourceUpdateSchema = z.object({ id: z.string().min(1), active: z.boolean() }).strict();
const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) }).strict();
const noParamsSchema = z.object({}).strict();

async function checkIngestionSourceHost(input: Record<string, unknown>): Promise<string | null> {
  const hostname = new URL(String(input.url)).hostname.toLowerCase();
  const { getPdfUrlAllowlist } = await import("@/features/mcp/server/settings-service");
  const allowlist = await getPdfUrlAllowlist();
  const allowed = allowlist.map((host) => host.toLowerCase()).some((host) => hostname === host || hostname.endsWith(`.${host}`));
  return allowlist.length > 0 && allowed ? null : "Host fora da allowlist de ingestão por URL.";
}

export const INGESTION_TOOLS: AdminToolDef[] = [
  { name: "uploads_list", title: "Listar uploads", description: "Lista arquivos enviados e trabalhos recentes.", domain: "ingestion", tier: "read", method: "GET", path: "uploads", inputSchema: uploadsListSchema, queryParams: Object.keys(uploadsListSchema.shape) as (keyof z.infer<typeof uploadsListSchema>)[], handler: async () => (await import("@/app/api/admin/uploads/route")).GET as never },
  { name: "uploads_questions", title: "Questões do upload", description: "Lista questões geradas a partir de um arquivo.", domain: "ingestion", tier: "read", method: "GET", path: "uploads/[fileId]/questions", inputSchema: uploadQuestionsSchema, pathParams: ["fileId"], queryParams: ["page", "pageSize"], handler: async () => (await import("@/app/api/admin/uploads/[fileId]/questions/route")).GET as never },
  { name: "ingestion_job_get", title: "Consultar trabalho de ingestão", description: "Retorna o estado de um trabalho de ingestão.", domain: "ingestion", tier: "read", method: "GET", path: "uploads/jobs/[jobId]", inputSchema: jobIdSchema, pathParams: ["jobId"], handler: async () => (await import("@/app/api/admin/uploads/jobs/[jobId]/route")).GET as never },
  { name: "exam_guide_status", title: "Status dos guias de exame", description: "Retorna estado e uploads recentes dos guias de exame.", domain: "ingestion", tier: "read", method: "GET", path: "pdf/exam-guide/status", inputSchema: noParamsSchema, handler: async () => (await import("@/app/api/admin/pdf/exam-guide/status/route")).GET as never },
  { name: "ingestion_job_cancel", title: "Cancelar trabalho de ingestão", description: "Cancela um trabalho de ingestão em andamento.", domain: "ingestion", tier: "write", method: "PATCH", path: "uploads/jobs/[jobId]", inputSchema: jobIdSchema, pathParams: ["jobId"], buildBody: () => ({ action: "cancel" }), handler: async () => (await import("@/app/api/admin/uploads/jobs/[jobId]/route")).PATCH as never },
  { name: "ingestion_source_create", title: "Criar fonte de ingestão", description: "Registra uma fonte de ingestão cuja URL esteja na allowlist configurada.", domain: "ingestion", tier: "write", method: "POST", path: "ingestion-sources", inputSchema: sourceCreateSchema, buildBody: (input) => input, preflight: checkIngestionSourceHost, handler: async () => (await import("@/app/api/admin/ingestion-sources/route")).POST as never },
  { name: "ingestion_source_update", title: "Atualizar fonte de ingestão", description: "Ativa ou desativa uma fonte de ingestão.", domain: "ingestion", tier: "write", method: "PATCH", path: "ingestion-sources", inputSchema: sourceUpdateSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/ingestion-sources/route")).PATCH as never },
  { name: "uploads_delete", title: "Excluir upload", description: "Exclui um arquivo enviado.", domain: "ingestion", tier: "danger", method: "DELETE", path: "uploads/[fileId]", inputSchema: fileIdSchema, pathParams: ["fileId"], handler: async () => (await import("@/app/api/admin/uploads/[fileId]/route")).DELETE as never },
  { name: "uploads_bulk_delete", title: "Excluir uploads em lote", description: "Exclui até 200 arquivos enviados pelos IDs informados.", domain: "ingestion", tier: "danger", method: "DELETE", path: "uploads", inputSchema: bulkDeleteSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/uploads/route")).DELETE as never },
];
