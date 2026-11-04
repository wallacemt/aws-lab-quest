import { z } from "zod";
import type { AdminToolDef } from "./types";

const id = z.string().min(1);
const achievementIdSchema = z.object({ achievementId: id }).strict();
const bossIdSchema = z.object({ bossId: id }).strict();
const themeIdSchema = z.object({ themeId: id }).strict();
const challengeIdSchema = z.object({ challengeId: id }).strict();
const listThemesSchema = z.object({
  page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(50).optional(),
  search: z.string().optional(), isPublic: z.enum(["true", "false"]).optional(),
}).strict();
const noParamsSchema = z.object({}).strict();
const triggerParamsSchema = z.object({
  sessionType: z.enum(["KC", "SIMULADO"]).optional(), minScorePercent: z.number().optional(),
  xpThreshold: z.number().optional(), sessionCountThreshold: z.number().optional(),
}).passthrough();
const achievementBodySchema = z.object({
  code: z.string().optional(), name: z.string().optional(), description: z.string().optional(),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]).optional(),
  target: z.number().positive().optional(), displayOrder: z.number().optional(), active: z.boolean().optional(),
  triggerType: z.string().optional(), triggerParams: triggerParamsSchema.nullable().optional(),
  imageUrl: z.string().nullable().optional(), generationPrompt: z.string().nullable().optional(),
}).strict();
const achievementCreateSchema = achievementBodySchema.extend({
  code: z.string().min(1), name: z.string().min(1), description: z.string().min(1), triggerType: z.string().min(1),
}).strict();
const suggestSchema = z.object({ count: z.number().optional() }).strict();
const achievementArtworkSchema = z.object({ achievementName: z.string().optional(), customPrompt: z.string().optional(), model: z.string().optional() }).strict();
const bossCreateSchema = z.object({
  name: z.string(), code: z.string(), themeService: z.string(), maxHp: z.number(),
  damagePerCorrect: z.number().optional(), artworkUrl: z.string().optional(), active: z.boolean().optional(),
}).strict();
const bossUpdateSchema = z.object({
  bossId: id, name: z.string().optional(), code: z.string().optional(), themeService: z.string().optional(),
  maxHp: z.number().optional(), damagePerCorrect: z.number().optional(), artworkUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
}).strict();
const bossArtworkSchema = z.object({ bossName: z.string().optional(), customPrompt: z.string().optional(), model: z.string().optional() }).strict();
const themeUpdateSchema = z.object({ themeId: id, isPublic: z.boolean() }).strict();
const challengeUpdateSchema = z.object({ challengeId: id, active: z.boolean().optional(), title: z.string().nullable().optional() }).strict();
const triggerChallengeSchema = z.object({ mode: z.enum(["open", "close"]) }).strict();
const pauseSchema = z.object({ paused: z.boolean() }).strict();

export const GAMIFICATION_TOOLS: AdminToolDef[] = [
  { name: "achievements_list", title: "Listar conquistas", description: "Lista conquistas cadastradas.", domain: "gamification", tier: "read", method: "GET", path: "achievements", inputSchema: noParamsSchema, handler: async () => (await import("@/app/api/admin/achievements/route")).GET as never },
  { name: "achievement_get", title: "Consultar conquista", description: "Retorna uma conquista pelo ID.", domain: "gamification", tier: "read", method: "GET", path: "achievements/[achievementId]", inputSchema: achievementIdSchema, pathParams: ["achievementId"], handler: async () => (await import("@/app/api/admin/achievements/[achievementId]/route")).GET as never },
  { name: "achievement_create", title: "Criar conquista", description: "Cria uma conquista.", domain: "gamification", tier: "write", method: "POST", path: "achievements", inputSchema: achievementCreateSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/achievements/route")).POST as never },
  { name: "achievement_update", title: "Atualizar conquista", description: "Atualiza uma conquista.", domain: "gamification", tier: "write", method: "PATCH", path: "achievements/[achievementId]", inputSchema: achievementBodySchema.extend({ achievementId: id }).strict(), pathParams: ["achievementId"], buildBody: ({ achievementId: _id, ...body }) => body, handler: async () => (await import("@/app/api/admin/achievements/[achievementId]/route")).PATCH as never },
  { name: "achievement_suggest", title: "Sugerir conquistas", description: "Gera sugestões de conquistas.", domain: "gamification", tier: "write", method: "POST", path: "achievements/suggest", inputSchema: suggestSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/achievements/suggest/route")).POST as never },
  { name: "achievement_generate_artwork", title: "Gerar arte da conquista", description: "Gera arte para uma conquista.", domain: "gamification", tier: "write", method: "POST", path: "achievements/generate-artwork", inputSchema: achievementArtworkSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/achievements/generate-artwork/route")).POST as never },
  { name: "achievement_delete", title: "Excluir conquista", description: "Exclui uma conquista.", domain: "gamification", tier: "danger", method: "DELETE", path: "achievements/[achievementId]", inputSchema: achievementIdSchema, pathParams: ["achievementId"], handler: async () => (await import("@/app/api/admin/achievements/[achievementId]/route")).DELETE as never },
  { name: "bosses_list", title: "Listar bosses", description: "Lista bosses da arena.", domain: "gamification", tier: "read", method: "GET", path: "arena/bosses", inputSchema: noParamsSchema, handler: async () => (await import("@/app/api/admin/arena/bosses/route")).GET as never },
  { name: "boss_get", title: "Consultar boss", description: "Retorna um boss pelo ID.", domain: "gamification", tier: "read", method: "GET", path: "arena/bosses/[bossId]", inputSchema: bossIdSchema, pathParams: ["bossId"], handler: async () => (await import("@/app/api/admin/arena/bosses/[bossId]/route")).GET as never },
  { name: "boss_create", title: "Criar boss", description: "Cria um boss para a arena.", domain: "gamification", tier: "write", method: "POST", path: "arena/bosses", inputSchema: bossCreateSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/arena/bosses/route")).POST as never },
  { name: "boss_update", title: "Atualizar boss", description: "Atualiza um boss.", domain: "gamification", tier: "write", method: "PUT", path: "arena/bosses/[bossId]", inputSchema: bossUpdateSchema, pathParams: ["bossId"], buildBody: ({ bossId: _id, ...body }) => body, handler: async () => (await import("@/app/api/admin/arena/bosses/[bossId]/route")).PUT as never },
  { name: "boss_suggest", title: "Sugerir bosses", description: "Gera sugestões de bosses.", domain: "gamification", tier: "write", method: "POST", path: "arena/bosses/suggest", inputSchema: suggestSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/arena/bosses/suggest/route")).POST as never },
  { name: "boss_generate_artwork", title: "Gerar arte do boss", description: "Gera arte para um boss.", domain: "gamification", tier: "write", method: "POST", path: "arena/bosses/generate-artwork", inputSchema: bossArtworkSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/arena/bosses/generate-artwork/route")).POST as never },
  { name: "boss_delete", title: "Excluir boss", description: "Exclui um boss.", domain: "gamification", tier: "danger", method: "DELETE", path: "arena/bosses/[bossId]", inputSchema: bossIdSchema, pathParams: ["bossId"], handler: async () => (await import("@/app/api/admin/arena/bosses/[bossId]/route")).DELETE as never },
  { name: "themes_list", title: "Listar temas", description: "Lista temas públicos e privados.", domain: "gamification", tier: "read", method: "GET", path: "themes", inputSchema: listThemesSchema, queryParams: Object.keys(listThemesSchema.shape) as (keyof z.infer<typeof listThemesSchema>)[], handler: async () => (await import("@/app/api/admin/themes/route")).GET as never },
  { name: "theme_update", title: "Moderar tema", description: "Altera a visibilidade pública do tema.", domain: "gamification", tier: "write", method: "PATCH", path: "themes/[themeId]", inputSchema: themeUpdateSchema, pathParams: ["themeId"], buildBody: ({ themeId: _id, ...body }) => body, handler: async () => (await import("@/app/api/admin/themes/[themeId]/route")).PATCH as never },
  { name: "theme_delete", title: "Excluir tema", description: "Exclui um tema.", domain: "gamification", tier: "danger", method: "DELETE", path: "themes/[themeId]", inputSchema: themeIdSchema, pathParams: ["themeId"], handler: async () => (await import("@/app/api/admin/themes/[themeId]/route")).DELETE as never },
  { name: "weekly_challenges_list", title: "Listar desafios semanais", description: "Lista desafios semanais.", domain: "gamification", tier: "read", method: "GET", path: "weekly-challenge", inputSchema: noParamsSchema, handler: async () => (await import("@/app/api/admin/weekly-challenge/route")).GET as never },
  { name: "weekly_challenge_get", title: "Consultar desafio semanal", description: "Retorna um desafio e suas participações.", domain: "gamification", tier: "read", method: "GET", path: "weekly-challenge/[challengeId]", inputSchema: challengeIdSchema, pathParams: ["challengeId"], handler: async () => (await import("@/app/api/admin/weekly-challenge/[challengeId]/route")).GET as never },
  { name: "weekly_challenge_update", title: "Atualizar desafio semanal", description: "Atualiza título ou estado do desafio.", domain: "gamification", tier: "write", method: "PATCH", path: "weekly-challenge/[challengeId]", inputSchema: challengeUpdateSchema, pathParams: ["challengeId"], buildBody: ({ challengeId: _id, ...body }) => body, handler: async () => (await import("@/app/api/admin/weekly-challenge/[challengeId]/route")).PATCH as never },
  { name: "weekly_challenge_suggest", title: "Sugerir títulos semanais", description: "Gera sugestões de título.", domain: "gamification", tier: "write", method: "POST", path: "weekly-challenge/suggest", inputSchema: suggestSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/weekly-challenge/suggest/route")).POST as never },
  { name: "weekly_challenge_trigger", title: "Acionar desafio semanal", description: "Solicita abertura ou fechamento manual.", domain: "gamification", tier: "write", method: "POST", path: "weekly-challenge/trigger", inputSchema: triggerChallengeSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/weekly-challenge/trigger/route")).POST as never },
  { name: "weekly_challenge_pause", title: "Pausar desafio semanal", description: "Pausa ou retoma a abertura automática.", domain: "gamification", tier: "write", method: "POST", path: "weekly-challenge/pause", inputSchema: pauseSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/weekly-challenge/pause/route")).POST as never },
];
