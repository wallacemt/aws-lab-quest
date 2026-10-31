import { ExternalLink } from "@/components/rich-text/ExternalLink";
import type { ReferenceLink } from "@/lib/reference-links";
export function ReferenceLinks({ references, trusted = true }: { references: ReferenceLink[]; trusted?: boolean }) {
  if (!references.length) return null;
  return <section className="mt-4 border-t pt-3"><h2 id="rich-text-references" className="mb-2 text-sm font-semibold">Referências AWS</h2><ul aria-labelledby="rich-text-references" className="list-disc pl-5">{references.map((ref) => <li key={ref.href}><ExternalLink href={ref.href} trusted={trusted}>{ref.label}</ExternalLink></li>)}</ul></section>;
}
