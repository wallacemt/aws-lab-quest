export function normalizeOptionText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (/^(null|undefined)$/i.test(normalized)) {
    return "";
  }

  return normalized;
}

export function hasRenderableOptionText(value: unknown): boolean {
  return normalizeOptionText(value).length > 0;
}
