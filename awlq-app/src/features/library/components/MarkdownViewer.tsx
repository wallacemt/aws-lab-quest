"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
}

/**
 * Renders instructor-authored markdown safely.
 *
 * Security note (ADR-07): rehype-raw is intentionally NOT included.
 * Raw HTML blocks in the markdown source are never passed through to the DOM,
 * preventing XSS from instructor-supplied content.
 */
export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-sm prose-invert max-w-none font-mono">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
