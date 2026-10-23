import { formatStatement } from "@/lib/statement-formatting";

export function StatementContent({ text }: { text: string }) {
  return (
    <>
      {formatStatement(text).map((segment, index) =>
        segment.type === "code" ? (
          <pre
            key={index}
            className="my-3 max-w-full overflow-x-auto border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] p-3 font-mono text-sm"
          >
            <code>{segment.text}</code>
          </pre>
        ) : (
          <span key={index} className="break-words font-[var(--font-body)]">
            {segment.text}
          </span>
        ),
      )}
    </>
  );
}
