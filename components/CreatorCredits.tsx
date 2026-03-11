import { PixelCard } from "@/components/ui/PixelCard";
import Link from "next/link";

export function CreatorCredits({ compact = true }: { compact?: boolean }) {
  return (
    <section className="mx-auto max-w-[600px] px-4 pb-8 xl:px-8">
      <PixelCard className="space-y-3">
        <h2 className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-primary)]">Creditos do Criador</h2>

        <p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
          Projeto criado por <span className="font-semibold text-[var(--pixel-text)]">Wallace Santana</span>.
        </p>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Link
            href="https://github.com/wallacemt"
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-3 py-2 text-center font-[var(--font-body)] text-sm hover:brightness-110"
          >
            GitHub
          </Link>
          <Link
            href="https://www.linkedin.com/in/wallace-santanak0/"
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-muted)] px-3 py-2 text-center font-[var(--font-body)] text-sm hover:brightness-110"
          >
            LinkedIn
          </Link>
        </div>

        {!compact ? (
          <div className="space-y-1 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">
            <p>Stack: Next.js, TypeScript, Gemini API, Tailwind CSS.</p>
            <p>Missao: transformar estudos AWS em jornadas gamificadas, acessiveis e divertidas.</p>
          </div>
        ) : null}
      </PixelCard>
    </section>
  );
}
