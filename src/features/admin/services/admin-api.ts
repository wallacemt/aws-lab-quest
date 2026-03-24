import {
  AdminApiError,
  AdminMetricsPayload,
  AdminQuestionsListParams,
  AdminQuestionListItem,
  AdminUploadSignedUrlPayload,
  AdminUploadsListParams,
  AdminUploadsPayload,
  AdminStatus,
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
