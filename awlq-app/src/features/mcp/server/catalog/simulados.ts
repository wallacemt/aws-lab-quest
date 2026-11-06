import { z } from "zod";
import type { AdminToolDef } from "./types";

const id = z.string().min(1);
const packIdSchema = z.object({ packId: id }).strict();
const listSchema = z.object({
  certificationCode: z.string().optional(), active: z.enum(["true", "false"]).optional(),
  search: z.string().optional(), sortBy: z.enum(["createdAt", "name", "difficultyScore", "questionCount"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(), minDifficultyScore: z.number().int().optional(),
  maxDifficultyScore: z.number().int().optional(), hasSessions: z.enum(["true", "false"]).optional(),
  page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(50).optional(),
}).strict();
const importItemSchema = z.object({
  statement: z.string().min(1), options: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length >= 2),
  correctOption: z.string().optional(), correctOptions: z.array(z.string()).optional(),
  difficulty: z.enum(["easy", "medium", "hard", "nightmare"]).optional(),
  questionType: z.enum(["single", "multi"]).optional(), topic: z.string().optional(),
  certificationCode: z.string().optional(), explanations: z.record(z.string(), z.string()).optional(),
  awsServiceCodes: z.array(z.string()).optional(), awsServiceNames: z.array(z.string()).optional(),
}).passthrough();
const packCreateSchema = z.object({
  name: z.string(), certificationCode: z.string(), questionIds: z.array(id), questions: z.array(importItemSchema).optional(),
  isSkillBuilder: z.boolean().optional(), artworkUrl: z.string().optional(), difficultyScore: z.number().finite().optional(),
}).strict();
const narrativeSchema = z.object({ stageName: z.string(), storyText: z.string(), awsContext: z.string() }).strict();
const packUpdateSchema = z.object({
  packId: id, active: z.boolean().optional(), isSkillBuilder: z.boolean().optional(), name: z.string().optional(),
  artworkUrl: z.string().nullable().optional(), difficultyScore: z.number().finite().optional(),
  addQuestionIds: z.array(id).optional(), removeQuestionIds: z.array(id).optional(),
  journeyNarrative: narrativeSchema.nullable().optional(),
}).strict();
const certificationSchema = z.object({ certificationCode: z.string() }).strict();
const autoStatusSchema = z.object({ certificationCode: z.string(), packSize: z.number().optional() }).strict();
const autoGenerateSchema = z.object({
  certificationCode: z.string().optional(), packSize: z.number().optional(), generateArtwork: z.boolean().optional(),
  pollinationsModel: z.string().optional(), imagePromptTemplate: z.string().optional(),
  generateNarrative: z.boolean().optional(), narrativePrompt: z.string().optional(),
}).strict();
const artworkSchema = z.object({ simuladoName: z.string().optional(), customPrompt: z.string().optional(), model: z.string().optional() }).strict();
const migrationSchema = z.object({ limit: z.number().int().optional(), dryRun: z.boolean().optional() }).strict();

export const SIMULADOS_TOOLS: AdminToolDef[] = [
  { name: "simulado_packs_list", title: "Listar pacotes de simulado", description: "Lista pacotes com filtros.", domain: "simulados", tier: "read", method: "GET", path: "simulado-packs", inputSchema: listSchema, queryParams: Object.keys(listSchema.shape) as (keyof z.infer<typeof listSchema>)[], handler: async () => (await import("@/app/api/admin/simulado-packs/route")).GET as never },
  { name: "simulado_pack_get", title: "Consultar pacote de simulado", description: "Retorna um pacote pelo ID.", domain: "simulados", tier: "read", method: "GET", path: "simulado-packs/[packId]", inputSchema: packIdSchema, pathParams: ["packId"], handler: async () => (await import("@/app/api/admin/simulado-packs/[packId]/route")).GET as never },
  { name: "simulado_generate_status", title: "Status da geração de simulados", description: "Consulta questões disponíveis para geração.", domain: "simulados", tier: "read", method: "GET", path: "simulado-packs/generate", inputSchema: certificationSchema, queryParams: ["certificationCode"], handler: async () => (await import("@/app/api/admin/simulado-packs/generate/route")).GET as never },
  { name: "simulado_generate_auto_status", title: "Status da geração automática", description: "Consulta disponibilidade para geração automática.", domain: "simulados", tier: "read", method: "GET", path: "simulado-packs/generate-auto", inputSchema: autoStatusSchema, queryParams: ["certificationCode", "packSize"], handler: async () => (await import("@/app/api/admin/simulado-packs/generate-auto/route")).GET as never },
  { name: "simulado_artwork_migration_status", title: "Status da migração de artes", description: "Conta artes pendentes de migração.", domain: "simulados", tier: "read", method: "GET", path: "simulado-packs/migrate-artwork", inputSchema: z.object({}).strict(), handler: async () => (await import("@/app/api/admin/simulado-packs/migrate-artwork/route")).GET as never },
  { name: "simulado_pack_create", title: "Criar pacote de simulado", description: "Cria pacote com questões.", domain: "simulados", tier: "write", method: "POST", path: "simulado-packs", inputSchema: packCreateSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/simulado-packs/route")).POST as never },
  { name: "simulado_pack_update", title: "Atualizar pacote de simulado", description: "Atualiza dados e questões do pacote.", domain: "simulados", tier: "write", method: "PATCH", path: "simulado-packs/[packId]", inputSchema: packUpdateSchema, pathParams: ["packId"], buildBody: ({ packId: _id, ...body }) => body, handler: async () => (await import("@/app/api/admin/simulado-packs/[packId]/route")).PATCH as never },
  { name: "simulado_generate", title: "Gerar simulados", description: "Gera pacotes a partir de questões disponíveis.", domain: "simulados", tier: "write", method: "POST", path: "simulado-packs/generate", inputSchema: certificationSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/simulado-packs/generate/route")).POST as never },
  { name: "simulado_generate_auto", title: "Gerar simulados automaticamente", description: "Gera pacotes automaticamente para certificações.", domain: "simulados", tier: "write", method: "POST", path: "simulado-packs/generate-auto", inputSchema: autoGenerateSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/simulado-packs/generate-auto/route")).POST as never },
  { name: "simulado_pack_generate_artwork", title: "Gerar arte do simulado", description: "Gera uma arte para o simulado.", domain: "simulados", tier: "write", method: "POST", path: "simulado-packs/generate-artwork", inputSchema: artworkSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/simulado-packs/generate-artwork/route")).POST as never },
  { name: "simulado_pack_delete", title: "Excluir pacote de simulado", description: "Exclui ou desativa um pacote em uso.", domain: "simulados", tier: "danger", method: "DELETE", path: "simulado-packs/[packId]", inputSchema: packIdSchema, pathParams: ["packId"], handler: async () => (await import("@/app/api/admin/simulado-packs/[packId]/route")).DELETE as never },
  { name: "simulado_artwork_migrate", title: "Migrar artes de simulados", description: "Migra artes armazenadas como data URL.", domain: "simulados", tier: "danger", method: "POST", path: "simulado-packs/migrate-artwork", inputSchema: migrationSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/simulado-packs/migrate-artwork/route")).POST as never },
];
