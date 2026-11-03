"use client";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { segmentRichText } from "@/lib/statement-formatting";
import { extractReferenceLinks } from "@/lib/reference-links";
import { ExternalLink } from "@/components/rich-text/ExternalLink";
import { CodeBlock } from "@/components/rich-text/CodeBlock";
import { BlobToken } from "@/components/rich-text/BlobToken";

function escapeAsterisks(text: string) { return text.replace(/\*\*([\s\S]+?)\*\*/g, (_, bold) => `\u0000${bold}\u0000`).replace(/\*/g, "\\*").replace(/\u0000/g, "**"); }
export function RichText({ text, inline = false, trustLinks = true, showReferences = false, className = "" }: { text: string; inline?: boolean; trustLinks?: boolean; showReferences?: boolean; className?: string }) {
  const extracted = useMemo(() => extractReferenceLinks(text), [text]);
  const segments = useMemo(() => segmentRichText(extracted.body), [extracted.body]);
  return <span className={`min-w-0 [overflow-wrap:anywhere] ${className}`}>{segments.map((segment, i) => segment.type === "code" ? <CodeBlock key={i} {...segment}/> : segment.type === "blob" ? <BlobToken key={i} text={segment.text}/> : <ReactMarkdown key={i} remarkPlugins={[[remarkGfm, { singleTilde: false }]]} disallowedElements={["img","h1","h2","h3","h4","h5","h6"]} unwrapDisallowed components={{ a: ({ href, children }) => <ExternalLink href={href} trusted={trustLinks}>{children}</ExternalLink>, code: ({ children }) => <code className="rounded bg-[var(--pixel-muted)]/60 px-1 italic font-[var(--font-body)]">{children}</code>, p: ({ children }) => inline ? <span>{children}</span> : <p>{children}</p> }}>{escapeAsterisks(segment.text)}</ReactMarkdown>)}{showReferences && <ReferenceLinksSlot refs={extracted.references} trusted={trustLinks}/>}</span>;
}
import { ReferenceLinks } from "@/components/rich-text/ReferenceLinks";
function ReferenceLinksSlot({ refs, trusted }: { refs: ReturnType<typeof extractReferenceLinks>["references"]; trusted: boolean }) { return <ReferenceLinks references={refs} trusted={trusted}/>; }
