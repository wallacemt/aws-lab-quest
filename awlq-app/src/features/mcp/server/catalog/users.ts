import { z } from "zod";
import type { AdminToolDef } from "./types";

const userId = z.string().min(1);
const usersListSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(50).optional(),
  search: z.string().optional(), role: z.string().optional(),
  accessStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  active: z.enum(["true", "false"]).optional(), certificationCode: z.string().optional(),
  createdFrom: z.string().optional(), createdTo: z.string().optional(),
  lastSeenFrom: z.string().optional(), lastSeenTo: z.string().optional(),
  sortBy: z.enum(["createdAt", "lastSeen", "name", "email", "role"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
}).strict();
const idSchema = z.object({ userId }).strict();
const updateSchema = z.object({
  userId, name: z.string().optional(), username: z.string().optional(),
  accessStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  accessDecisionReason: z.string().optional(), active: z.boolean().optional(),
  certificationPresetId: z.string().nullable().optional(),
}).strict();
const rejectSchema = z.object({ userId, reason: z.string().optional() }).strict();
const inviteSchema = z.object({ userIds: z.array(z.string()).optional() }).strict();

export const USERS_TOOLS: AdminToolDef[] = [
  { name: "users_list", title: "Listar usuários", description: "Lista usuários com filtros e paginação; somente leitura.", domain: "users", tier: "read", method: "GET", path: "users", inputSchema: usersListSchema, queryParams: Object.keys(usersListSchema.shape) as (keyof z.infer<typeof usersListSchema>)[], handler: async () => (await import("@/app/api/admin/users/route")).GET as never },
  { name: "users_get", title: "Consultar usuário", description: "Retorna perfil e atividade de um usuário; somente leitura.", domain: "users", tier: "read", method: "GET", path: "users/[userId]", inputSchema: idSchema, pathParams: ["userId"], handler: async () => (await import("@/app/api/admin/users/[userId]/route")).GET as never },
  { name: "users_update", title: "Atualizar usuário", description: "Atualiza campos permitidos de perfil e acesso. Não permite alterar papel (role).", domain: "users", tier: "write", method: "PATCH", path: "users/[userId]", inputSchema: updateSchema, pathParams: ["userId"], buildBody: ({ userId: _id, ...body }) => body, handler: async () => (await import("@/app/api/admin/users/[userId]/route")).PATCH as never },
  { name: "users_approve", title: "Aprovar usuário", description: "Ativa a conta, aprova o acesso e tenta enviar o e-mail de liberação.", domain: "users", tier: "write", method: "POST", path: "users/[userId]/approve", inputSchema: idSchema, pathParams: ["userId"], handler: async () => (await import("@/app/api/admin/users/[userId]/approve/route")).POST as never },
  { name: "users_reject", title: "Rejeitar usuário", description: "Marca o acesso do usuário como rejeitado e registra o motivo opcional.", domain: "users", tier: "write", method: "POST", path: "users/[userId]/reject", inputSchema: rejectSchema, pathParams: ["userId"], buildBody: ({ userId: _id, ...body }) => body, handler: async () => (await import("@/app/api/admin/users/[userId]/reject/route")).POST as never },
  { name: "users_engagement_invite", title: "Enviar convite de engajamento", description: "Envia convite por e-mail aos usuários elegíveis; sem IDs, pode alcançar até 500 usuários.", domain: "users", tier: "write", method: "POST", path: "users/engagement-invite", inputSchema: inviteSchema, buildBody: (input) => input, handler: async () => (await import("@/app/api/admin/users/engagement-invite/route")).POST as never },
  { name: "users_delete", title: "Desativar usuário", description: "Desativa a conta do usuário (a rota DELETE não apaga o registro).", domain: "users", tier: "danger", method: "DELETE", path: "users/[userId]", inputSchema: idSchema, pathParams: ["userId"], handler: async () => (await import("@/app/api/admin/users/[userId]/route")).DELETE as never },
];
