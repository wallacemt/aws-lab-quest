import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { parseSafeExternalUrl } from "@/lib/safe-url";

export function ExternalLink({ href, children, trusted = true }: { href: unknown; children?: React.ReactNode; trusted?: boolean }) {
  const safe = parseSafeExternalUrl(href);
  const label = children ?? safe?.hostname ?? String(href ?? "");
  if (!safe) return <span>{label}</span>;
  if (!trusted) return <span>{label} ({safe.hostname})</span>;
  return <a href={safe.url.href} target="_blank" rel="noopener noreferrer nofollow ugc">{safe.isAws && <span aria-label="AWS Docs">AWS Docs </span>}{label}<span className="sr-only"> ({safe.hostname})</span><ExternalLinkIcon aria-hidden="true" size={12} className="ml-1 inline" /></a>;
}
