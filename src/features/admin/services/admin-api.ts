import {
  AdminApiError,
  AdminQuestionListItem,
  AdminStatus,
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

export async function listAdminUsers(input: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<PaginatedResult<AdminUserListItem>> {
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

export async function listAdminQuestions(input: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<PaginatedResult<AdminQuestionListItem>> {
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
