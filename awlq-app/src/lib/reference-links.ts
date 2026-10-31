export type ReferenceLink = { href: string; label: string; hostname: string };
export function extractReferenceLinks(text: string): { body: string; references: ReferenceLink[] } {
  const marker = /\*{0,2}Refer[eê]ncias(?: AWS)?:\*{0,2}/gi;
  let last: RegExpExecArray | null = null; let match: RegExpExecArray | null;
  while ((match = marker.exec(text))) last = match;
  if (!last) return { body: text, references: [] };
  const tail = text.slice(last.index + last[0].length);
  const urls = tail.match(/https?:\/\/[^\s<>]+/gi) ?? [];
  const refs: ReferenceLink[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const href = raw.replace(/[.,;:!?)}\]]+$/g, "");
    try {
      const hostname = new URL(href).hostname;
      if (!seen.has(href)) { seen.add(href); refs.push({ href, hostname, label: hostname === "aws.amazon.com" || hostname.endsWith(".aws.amazon.com") ? "AWS Docs" : hostname }); }
    } catch { /* ignore malformed URL */ }
  }
  return refs.length ? { body: text.slice(0, last.index).trimEnd(), references: refs } : { body: text, references: [] };
}
