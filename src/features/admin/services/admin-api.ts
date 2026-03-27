import {
  AdminApiError,
  AdminMetricsPayload,
  AdminQuestionsListParams,
  AdminQuestionListItem,
  AdminUploadSignedUrlPayload,
  AdminUploadQuestionsPayload,
  AdminUploadsListParams,
  AdminUploadsPayload,
  AdminStatus,
  AdminEmailSendPayload,
  AdminEmailTemplateCreatePayload,
  AdminEmailTemplateItem,
  AdminEmailTemplateUpdatePayload,
  AdminUserUpdatePayload,
  AdminUsersListParams,
  AdminUserListItem,
  PaginatedResult,
} from "@/features/admin/types";

export async function getAdminStatus(): Promise<AdminStatus> {
  const response = await fetch("/api/admin/status", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Nao foi possivel validar acesso admin.";

    try {
      const payload = (await response.json()) as AdminApiError;
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Keep fallback message for non-JSON responses.
    }

    throw new Error(message);
  }

  return (await response.json()) as AdminStatus;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      continue;
    }

    query.set(key, String(value));
  }

  return query.toString();
}

export async function listAdminUsers(input: AdminUsersListParams): Promise<PaginatedResult<AdminUserListItem>> {
  const qs = toQueryString(input);
  const response = await fetch(`/api/admin/users?${qs}`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar usuarios.");
  }

  return (await response.json()) as PaginatedResult<AdminUserListItem>;
}

export async function approveAdminUser(userId: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${userId}/approve`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel aprovar usuario.");
  }
}

export async function rejectAdminUser(userId: string, reason?: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${userId}/reject`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel recusar usuario.");
  }
}

export async function updateAdminUser(userId: string, payload: AdminUserUpdatePayload): Promise<void> {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel atualizar usuario.");
  }
}

export async function deactivateAdminUser(userId: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel desativar usuario.");
  }
}

export async function sendDailyPracticeInvite(userIds?: string[]): Promise<{ sent: number }> {
  const response = await fetch("/api/admin/users/engagement-invite", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds }),
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel enviar convites de pratica diaria.");
  }

  return (await response.json()) as { sent: number };
}

export async function listAdminEmailTemplates(): Promise<AdminEmailTemplateItem[]> {
  const response = await fetch("/api/admin/email/templates", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar templates de email.");
  }

  const payload = (await response.json()) as { templates: AdminEmailTemplateItem[] };
  return payload.templates;
}

export async function createAdminEmailTemplate(
  input: AdminEmailTemplateCreatePayload,
): Promise<AdminEmailTemplateItem> {
  const response = await fetch("/api/admin/email/templates", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as AdminApiError;
    throw new Error(payload.error ?? "Nao foi possivel criar template.");
  }

  const payload = (await response.json()) as { template: AdminEmailTemplateItem };
  return payload.template;
}

export async function updateAdminEmailTemplate(
  templateId: string,
  input: AdminEmailTemplateUpdatePayload,
): Promise<AdminEmailTemplateItem> {
  const response = await fetch(`/api/admin/email/templates/${templateId}`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as AdminApiError;
    throw new Error(payload.error ?? "Nao foi possivel atualizar template.");
  }

  const payload = (await response.json()) as { template: AdminEmailTemplateItem };
  return payload.template;
}

export async function deleteAdminEmailTemplate(templateId: string): Promise<void> {
  const response = await fetch(`/api/admin/email/templates/${templateId}`, {
    method: "DELETE",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as AdminApiError;
    throw new Error(payload.error ?? "Nao foi possivel remover template.");
  }
}

export async function sendAdminEmailTemplate(input: AdminEmailSendPayload): Promise<{ sent: number; failed: number }> {
  const response = await fetch("/api/admin/email/send", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as AdminApiError;
    throw new Error(payload.error ?? "Nao foi possivel enviar email.");
  }

  return (await response.json()) as { sent: number; failed: number };
}

export async function listAdminQuestions(
  input: AdminQuestionsListParams,
): Promise<PaginatedResult<AdminQuestionListItem>> {
  const qs = toQueryString(input);
  const response = await fetch(`/api/admin/questions?${qs}`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar questoes.");
  }

  return (await response.json()) as PaginatedResult<AdminQuestionListItem>;
}

export async function getAdminMetrics(days = 30): Promise<AdminMetricsPayload> {
  const response = await fetch(`/api/admin/metrics?days=${days}`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar metricas do dashboard.");
  }

  return (await response.json()) as AdminMetricsPayload;
}

export async function listAdminUploads(input: AdminUploadsListParams): Promise<AdminUploadsPayload> {
  const qs = toQueryString(input);
  const response = await fetch(`/api/admin/uploads?${qs}`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar historico de uploads.");
  }

  return (await response.json()) as AdminUploadsPayload;
}

export async function getAdminUploadSignedUrl(fileId: string, ttlSeconds = 180): Promise<AdminUploadSignedUrlPayload> {
  const response = await fetch(`/api/admin/uploads/${fileId}/signed-url?ttl=${ttlSeconds}`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Nao foi possivel gerar link seguro do arquivo.";

    try {
      const payload = (await response.json()) as AdminApiError;
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  }

  return (await response.json()) as AdminUploadSignedUrlPayload;
}

export async function listAdminUploadQuestions(
  fileId: string,
  input: { page?: number; pageSize?: number } = {},
): Promise<AdminUploadQuestionsPayload> {
  const qs = toQueryString({
    page: input.page ?? 1,
    pageSize: input.pageSize ?? 10,
  });

  const response = await fetch(`/api/admin/uploads/${fileId}/questions?${qs}`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Nao foi possivel carregar questoes do documento.";

    try {
      const payload = (await response.json()) as AdminApiError;
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  }

  return (await response.json()) as AdminUploadQuestionsPayload;
}
