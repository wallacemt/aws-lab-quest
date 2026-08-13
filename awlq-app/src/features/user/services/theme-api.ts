/** Client-side fetchers for the personalization / custom-theme API routes. */

export type UserTheme = {
  id: string;
  name: string;
  colors: Record<string, string>;
  bgImageUrl: string | null;
  isPublic: boolean;
  createdAt: string;
};

export type CommunityTheme = {
  id: string;
  name: string;
  colors: Record<string, string>;
  bgImageUrl: string | null;
  createdAt: string;
  authorUsername: string | null;
  authorName: string;
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Erro na API (${response.status}).`);
  return data;
}

export async function fetchMyThemes(): Promise<{ themes: UserTheme[] }> {
  return apiFetch("/api/user/themes");
}

export async function createTheme(input: {
  name: string;
  colors: Record<string, string>;
  bgImageUrl?: string | null;
}): Promise<{ theme: UserTheme }> {
  return apiFetch("/api/user/themes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateTheme(
  themeId: string,
  input: { name?: string; isPublic?: boolean },
): Promise<{ theme: UserTheme }> {
  return apiFetch(`/api/user/themes/${themeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteTheme(themeId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/user/themes/${themeId}`, { method: "DELETE" });
}

export async function fetchCommunityThemes(): Promise<{ themes: CommunityTheme[] }> {
  return apiFetch("/api/community-themes");
}

export async function uploadThemeImage(file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append("image", file);
  return apiFetch("/api/user/theme-image", { method: "POST", body: formData });
}

export async function updatePersonalization(input: {
  themePreset?: string;
  bgImageUrl?: string | null;
  customThemeId?: string | null;
}): Promise<{ bgImageUrl: string | null; themePreset: string; customColors: Record<string, string> | null }> {
  return apiFetch("/api/user/personalization", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
