import { z } from "zod";
import type { AdminToolDef } from "./types";

const questionId = z.string().min(1);
const reportId = z.string().min(1);
const idSchema = z.object({ questionId }).strict();
const questionListSchema = z.object({
  page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(200).optional(),
  search: z.string().optional(), difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  questionType: z.enum(["single", "multi"]).optional(), usage: z.enum(["KC", "SIMULADO", "BOTH"]).optional(),
  active: z.enum(["true", "false"]).optional(), certificationCode: z.string().optional(),
  awsServiceCode: z.string().optional(), reportStatus: z.enum(["REPORTED", "RESOLVED", "DISMISSED"]).optional(),
  sortBy: z.enum(["createdAt", "difficulty", "usage", "topic", "externalId", "active", "questionType"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(), createdFrom: z.string().optional(), createdTo: z.string().optional(),
}).strict();
const questionPatchSchema = z.object({
  questionId, statement: z.string().optional(), topic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard", "nightmare"]).optional(),
  questionType: z.enum(["single", "multi"]).optional(), usage: z.enum(["KC", "SIMULADO", "BOTH"]).optional(),
  active: z.boolean().optional(), optionA: z.string().optional(), optionB: z.string().optional(),
  optionC: z.string().optional(), optionD: z.string().optional(), optionE: z.string().nullable().optional(),
  correctOption: z.string().optional(), correctOptions: z.array(z.string()).nullable().optional(),
  explanationA: z.string().nullable().optional(), explanationB: z.string().nullable().optional(),
  explanationC: z.string().nullable().optional(), explanationD: z.string().nullable().optional(),
  explanationE: z.string().nullable().optional(),
  options: z.array(z.object({ label: z.enum(["A", "B", "C", "D", "E"]).optional(), content: z.string().nullable().optional(), explanation: z.string().nullable().optional(), isCorrect: z.boolean().optional() }).strict()).optional(),
  serviceCodes: z.array(z.string()).nullable().optional(),
}).strict();
const reportListSchema = z.object({ questionId, page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(50).optional(), status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]).optional() }).strict();
const reportUpdateSchema = z.object({ questionId, reportId, status: z.enum(["RESOLVED", "DISMISSED"]), reviewNotes: z.string().optional() }).strict();
const statsSchema = z.object({ from: z.string(), to: z.string(), certificationCode: z.string().optional() }).strict();
const certificationSchema = z.object({ certificationCode: z.string().optional() }).strict();
const availableSchema = z.object({ certificationCode: z.string(), search: z.string().optional(), difficulty: z.enum(["easy", "medium", "hard"]).optional(), topic: z.string().optional(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional() }).strict();
const fillStatusSchema = z.object({ list: z.enum(["true", "false"]).optional(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(50).optional() }).strict();
const fillRunSchema = z.object({ batchSize: z.number().int().positive().optional(), chunkSize: z.number().int().positive().optional(), totalToProcess: z.number().int().positive().optional(), delayMs: z.number().int().nonnegative().optional(), dryRun: z.boolean().optional() }).strict();
const batchUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-active"), ids: z.array(z.string().min(1)).min(1), active: z.boolean() }).strict(),
  z.object({ action: z.literal("set-usage"), ids: z.array(z.string().min(1)).min(1), usage: z.enum(["KC", "SIMULADO", "BOTH"]) }).strict(),
  z.object({ action: z.literal("set-certification"), ids: z.array(z.string().min(1)).min(1), certificationCode: z.string().nullable().optional() }).strict(),
  z.object({ action: z.literal("set-difficulty"), ids: z.array(z.string().min(1)).min(1), difficulty: z.enum(["easy", "medium", "hard"]) }).strict(),
]);
const batchDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) }).strict();
const importQuestionSchema = z.object({
  statement: z.string().min(1), options: z.record(z.enum(["A", "B", "C", "D", "E"]), z.string()).refine((options) => Object.keys(options).length >= 2),
  correctOption: z.string().optional(), correctOptions: z.array(z.string()).optional(),
  difficulty: z.enum(["easy", "medium", "hard", "nightmare"]).optional(), questionType: z.enum(["single", "multi"]).optional(),
  topic: z.string().optional(), certificationCode: z.string().optional(),
  explanations: z.record(z.enum(["A", "B", "C", "D", "E"]), z.string()).optional(),
  awsServiceCodes: z.array(z.string()).optional(), awsServiceNames: z.array(z.string()).optional(),
}).passthrough();
const importSchema = z.object({ questions: z.array(importQuestionSchema).min(1).max(200), defaultCertificationCode: z.string().optional(), dryRun: z.boolean().optional() }).strict();

export const QUESTIONS_TOOLS: AdminToolDef[] = [
  { name: "questions_list", title: "Listar questões", description: "Lista questões com filtros e paginação.", domain: "questions", tier: "read", method: "GET", path: "questions", inputSchema: questionListSchema, queryParams: Object.keys(questionListSchema.shape) as (keyof z.infer<typeof questionListSchema>)[], handler: async () => (await import("@/app/api/admin/questions/route")).GET as never },
  { name: "questions_get", title: "Consultar questão", description: "Retorna uma questão pelo ID.", domain: "questions", tier: "read", method: "GET", path: "questions/[questionId]", inputSchema: idSchema, pathParams: ["questionId"], handler: async () => (await import("@/app/api/admin/questions/[questionId]/route")).GET as never },
  { name: "questions_stats", title: "Estatísticas de questões", description: "Retorna estatísticas no intervalo informado.", domain: "questions", tier: "read", method: "GET", path: "questions/stats", inputSchema: statsSchema, queryParams: ["from", "to", "certificationCode"], handler: async () => (await import("@/app/api/admin/questions/stats/route")).GET as never },
  { name: "questions_duplicates", title: "Questões duplicadas", description: "Localiza grupos de questões duplicadas.", domain: "questions", tier: "read", method: "GET", path: "questions/duplicates", inputSchema: certificationSchema, queryParams: ["certificationCode"], handler: async () => (await import("@/app/api/admin/questions/duplicates/route")).GET as never },
  { name: "questions_available_for_pack", title: "Questões disponíveis para pacote", description: "Lista questões disponíveis para um pacote de simulado.", domain: "questions", tier: "read", method: "GET", path: "questions/available-for-pack", inputSchema: availableSchema, queryParams: Object.keys(availableSchema.shape) as (keyof z.infer<typeof availableSchema>)[], handler: async () => (await import("@/app/api/admin/questions/available-for-pack/route")).GET as never },
  { name: "questions_reports_list", title: "Listar denúncias da questão", description: "Lista denúncias associadas à questão.", domain: "questions", tier: "read", method: "GET", path: "questions/[questionId]/reports", inputSchema: reportListSchema, pathParams: ["questionId"], queryParams: ["page", "pageSize", "status"], handler: async () => (await import("@/app/api/admin/questions/[questionId]/reports/route")).GET as never },
  { name: "questions_fill_missing_status", title: "Status do preenchimento de questões", description: "Lista questões com dados ausentes.", domain: "questions", tier: "read", method: "GET", path: "questions/fill-missing", inputSchema: fillStatusSchema, queryParams: ["list", "page", "pageSize"], handler: async () => (await import("@/app/api/admin/questions/fill-missing/route")).GET as never },
  { name: "questions_update", title: "Atualizar questão", description: "Atualiza os campos permitidos de uma questão.", domain: "questions", tier: "write", method: "PATCH", path: "questions/[questionId]", inputSchema: questionPatchSchema, pathParams: ["questionId"], buildBody: ({ questionId: _id, ...body }) => body, handler: async () => (await import("@/app/api/admin/questions/[questionId]/route")).PATCH as never },
  { name: "questions_report_update", title: "Atualizar denúncia", description: "Resolve ou descarta uma denúncia da questão.", domain: "questions", tier: "write", method: "PATCH", path: "questions/[questionId]/reports/[reportId]", inputSchema: reportUpdateSchema, pathParams: ["questionId", "reportId"], buildBody: ({ questionId: _qid, reportId: _rid, ...body }) => body, handler: async () => (await import("@/app/api/admin/questions/[questionId]/reports/[reportId]/route")).PATCH as never },
  { name: "questions_batch_update", title: "Atualizar questões em lote", description: "Aplica uma das ações permitidas a um conjunto de questões.", domain: "questions", tier: "write", method: "POST", path: "questions/batch", inputSchema: batchUpdateSchema as unknown as AdminToolDef["inputSchema"], buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/questions/batch/route")).POST as never },
  { name: "questions_import_json", title: "Importar questões JSON", description: "Importa questões a partir do payload JSON validado pela rota.", domain: "questions", tier: "write", method: "POST", path: "questions/import-json", inputSchema: importSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/questions/import-json/route")).POST as never },
  { name: "questions_fill_missing_run", title: "Preencher dados ausentes", description: "Executa preenchimento de tópicos e serviços ausentes.", domain: "questions", tier: "write", method: "POST", path: "questions/fill-missing", inputSchema: fillRunSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/questions/fill-missing/route")).POST as never },
  { name: "questions_delete", title: "Excluir questão", description: "Exclui uma questão pelo ID.", domain: "questions", tier: "danger", method: "DELETE", path: "questions/[questionId]", inputSchema: idSchema, pathParams: ["questionId"], handler: async () => (await import("@/app/api/admin/questions/[questionId]/route")).DELETE as never },
  { name: "questions_batch_delete", title: "Excluir questões em lote", description: "Exclui as questões informadas.", domain: "questions", tier: "danger", method: "POST", path: "questions/batch", inputSchema: batchDeleteSchema, buildBody: ({ ids }) => ({ action: "delete", ids }), handler: async () => (await import("@/app/api/admin/questions/batch/route")).POST as never },
];
