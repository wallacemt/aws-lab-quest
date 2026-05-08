export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

export function inferQuestionCountFromText(value: string): number {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const markerRegex = /(?:^|\n)\s*(?:pergunta\s+|quest[aã]o\s*)?(\d{1,3})\s*[\)\.\-:]/gim;
  const identifiers = new Set<number>();

  for (const match of normalized.matchAll(markerRegex)) {
    const numberValue = Number(match[1]);
    if (Number.isFinite(numberValue) && numberValue > 0) {
      identifiers.add(numberValue);
    }
  }

  return identifiers.size;
}