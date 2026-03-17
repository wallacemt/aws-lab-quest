import { AdminApiError, AdminStatus } from "@/features/admin/types";

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
