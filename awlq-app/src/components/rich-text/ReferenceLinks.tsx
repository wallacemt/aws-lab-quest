"use client";

import type { CSSProperties } from "react";
import { ExternalLink } from "@/components/rich-text/ExternalLink";
import type { ReferenceLink } from "@/lib/reference-links";

export function ReferenceLinks({ references, trusted = true }: { references: ReferenceLink[]; trusted?: boolean }) {
  if (!references.length) return null;

  return (
    <section className="mt-4 border-t pt-3">
      <h2 id="rich-text-references" className="mb-2 text-sm font-semibold">Referências AWS</h2>
      <ul aria-labelledby="rich-text-references" className="list-disc pl-5">
        {references.map((ref, index) => (
          <li
            key={ref.href}
            style={{ "--tw-animation-delay": `${index * 80}ms` } as CSSProperties}
            className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none motion-reduce:transition-none"
          >
            <span className="group relative inline-block">
              <ExternalLink href={ref.href} trusted={trusted}>
                <span className="relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-current after:opacity-0 after:transition-[width,opacity] after:duration-300 after:delay-100 group-hover:after:w-full group-hover:after:opacity-70 motion-reduce:after:transition-none">
                  {ref.label}
                </span>
              </ExternalLink>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
