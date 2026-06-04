import type { LibraryContent } from "@prisma/client";
import type { LibraryContentLite, LibraryContentWithUrl } from "@/features/library/types";

// ─── User-facing fetchers ─────────────────────────────────────────────────────

export type LibraryFilters = {
  category?: string;
  serviceCode?: string;
  chainId?: string;
};

export async function getLibraryContent(filters: LibraryFilters = {}): Promise<LibraryContentLite[]> {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.serviceCode) params.set("serviceCode", filters.serviceCode);
  if (filters.chainId) params.set("chainId", filters.chainId);

  const query = params.toString();
  const url = query ? `/api/library?${query}` : "/api/library";

  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Falha ao carregar a biblioteca.");
  }

  const data = (await response.json()) as { content: LibraryContentLite[] };
  return data.content;
}

export async function getLibraryItem(contentId: string): Promise<LibraryContentWithUrl> {
  const response = await fetch(`/api/library/${contentId}`, { credentials: "include" });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Conteúdo não encontrado.");
    throw new Error("Falha ao carregar o conteúdo.");
  }

  const data = (await response.json()) as { content: LibraryContent; signedUrl?: string };
  return { ...data.content, signedUrl: data.signedUrl };
}

// ─── Admin fetchers ───────────────────────────────────────────────────────────

export type CreateLibraryContentInput = {
  type: string;
  title: string;
  description?: string;
  category: string;
  certificationPresetId?: string;
  awsServiceId?: string;
  questChainId?: string;
  bodyMarkdown?: string;
  authorName: string;
  authorUrl?: string;
  authorContact?: string;
  published?: boolean;
};

export async function adminGetAllLibraryContent(): Promise<LibraryContent[]> {
  const response = await fetch("/api/admin/library", { credentials: "include" });
  if (!response.ok) throw new Error("Falha ao carregar conteúdo da biblioteca.");
  const data = (await response.json()) as { content: LibraryContent[] };
  return data.content;
}

export async function adminCreateLibraryContent(
  input: CreateLibraryContentInput,
): Promise<LibraryContent> {
  const response = await fetch("/api/admin/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Falha ao criar conteúdo.");
  }
  const data = (await response.json()) as { content: LibraryContent };
  return data.content;
}

export async function adminUpdateLibraryContent(
  contentId: string,
  updates: Partial<CreateLibraryContentInput>,
): Promise<LibraryContent> {
  const response = await fetch(`/api/admin/library/${contentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Falha ao atualizar conteúdo.");
  }
  const data = (await response.json()) as { content: LibraryContent };
  return data.content;
}

export async function adminDeleteLibraryContent(contentId: string): Promise<void> {
  const response = await fetch(`/api/admin/library/${contentId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Falha ao deletar conteúdo.");
  }
}

export async function adminUploadLibraryFile(
  contentId: string,
  file: File,
): Promise<{ storagePath: string; storageBucket: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/admin/library/${contentId}/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Falha ao enviar arquivo.");
  }
  return response.json() as Promise<{ storagePath: string; storageBucket: string }>;
}
