"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ExamGuideInfo = {
  markdown: string;
  preview: string;
  highlights: string[];
  totalChars: number;
};

type Props = {
  examGuideInfo: ExamGuideInfo | null;
  loadingExamGuide: boolean;
  examGuideError: string | null;
};

export function SimuladoExamGuide({ examGuideInfo, loadingExamGuide, examGuideError }: Props) {
  if (loadingExamGuide) {
    return <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">Carregando Exam Guide...</p>;
  }

  if (examGuideError) {
    return <p className="font-[var(--font-body)] text-xs text-yellow-300">{examGuideError}</p>;
  }

  if (!examGuideInfo) {
    return (
      <p className="font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
        Exam guide nao configurado para esta certificacao.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
        Exam guide oficial — {examGuideInfo.totalChars} caracteres
      </p>

      {examGuideInfo.highlights.length > 0 && (
        <div className="space-y-1 border border-[var(--pixel-border)] bg-[var(--pixel-bg)] p-3">
          <p className="font-mono text-[10px] uppercase text-[var(--pixel-accent)]">Topicos de foco</p>
          {examGuideInfo.highlights.map((item) => (
            <ReactMarkdown
              key={item}
              remarkPlugins={[remarkGfm]}
              components={{
                strong: ({ children }) => (
                  <h3 className="mb-1 mt-2 text-[0.7rem] uppercase text-[var(--pixel-subtext)]">{children}</h3>
                ),
              }}
            >
              {item}
            </ReactMarkdown>
          ))}
        </div>
      )}

      {examGuideInfo.markdown.trim().length > 0 && (
        <div className="max-h-[40rem] overflow-auto border border-[var(--pixel-border)] bg-[var(--pixel-card)] p-3">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-2 font-mono text-sm uppercase text-primary">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-2 mt-3 font-mono text-xs uppercase text-accent">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-1 mt-2 font-mono text-[11px] uppercase text-[var(--pixel-subtext)]">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="mb-2 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">{children}</p>
              ),
              li: ({ children }) => (
                <li className="mb-1 ml-4 list-disc font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                  {children}
                </li>
              ),
              table: ({ children }) => <table className="mb-2 w-full border-collapse text-xs">{children}</table>,
              th: ({ children }) => (
                <th className="border border-[var(--pixel-border)] px-2 py-1 text-left font-mono text-[10px] uppercase text-[var(--pixel-subtext)]">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-[var(--pixel-border)] px-2 py-1 font-[var(--font-body)] text-xs text-[var(--pixel-subtext)]">
                  {children}
                </td>
              ),
            }}
          >
            {examGuideInfo.markdown}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
