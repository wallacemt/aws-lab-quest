export function parseSafeExternalUrl(href: unknown): { url: URL; hostname: string; isAws: boolean } | null {
  let url: URL;
  try { if (typeof href !== "string") return null; url = new URL(href); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const hostname = url.hostname;
  return { url, hostname, isAws: hostname === "aws.amazon.com" || hostname.endsWith(".aws.amazon.com") };
}
