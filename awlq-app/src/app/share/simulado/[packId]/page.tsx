import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSimuladoDifficultyLabel } from "@/lib/simulado-difficulty";

type Props = { params: Promise<{ packId: string }> };

async function getPack(packId: string) {
  return prisma.simuladoPack.findUnique({
    where: { id: packId },
    include: { certificationPreset: { select: { name: true, code: true } }, _count: { select: { questions: true } } },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { packId } = await params;
  const pack = await getPack(packId);
  if (!pack || !pack.active) return { title: "Simulado indisponível | AWS Lab Quest" };
  const certification = pack.certificationPreset?.name ?? pack.certificationPreset?.code ?? "AWS";
  const difficulty = getSimuladoDifficultyLabel(pack.difficultyScore);
  const title = `${pack.name} · ${certification} · ${difficulty}`;
  const description = `Simulado ${pack.name} para ${certification}, nível ${difficulty}, com ${pack._count.questions} questões.`;
  const image = `/share/simulado/${encodeURIComponent(pack.id)}/opengraph-image`;
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ShareSimuladoPage({ params }: Props) {
  const { packId } = await params;
  const pack = await getPack(packId);
  if (!pack || !pack.active) {
    return <main className="grid min-h-screen place-items-center bg-[var(--pixel-bg)] p-4"><div className="w-full max-w-lg border-4 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-6 text-center"><p className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Simulado indisponível</p><p className="mt-2 font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Este link é inválido ou o simulado não está mais disponível.</p><Link href="/simulado" className="mt-4 inline-block border-2 border-[var(--pixel-border)] px-3 py-2 font-mono text-[10px] uppercase">Ver simulados</Link></div></main>;
  }
  const certification = pack.certificationPreset?.name ?? pack.certificationPreset?.code ?? "AWS";
  const difficulty = getSimuladoDifficultyLabel(pack.difficultyScore);
  return <main className="grid min-h-screen place-items-center bg-[var(--pixel-bg)] p-4"><article className="w-full max-w-3xl overflow-hidden border-4 border-[var(--pixel-primary)] bg-[var(--pixel-card)] shadow-[8px_8px_0_0_#000]">{pack.artworkUrl && <img src={pack.artworkUrl} alt={`Arte do simulado ${pack.name}`} className="h-64 w-full object-cover" />}<div className="space-y-4 p-6"><p className="font-mono text-xs uppercase text-[var(--pixel-accent)]">Simulado AWS Lab Quest</p><h1 className="font-[var(--font-body)] text-2xl text-[var(--pixel-text)]">{pack.name}</h1><p className="font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Certificação: {certification}</p><div className="flex flex-wrap gap-3 font-mono text-xs uppercase"><span className="border-2 border-[var(--pixel-border)] px-3 py-2">{difficulty}</span><span className="border-2 border-[var(--pixel-border)] px-3 py-2">{pack._count.questions} questões</span></div><Link href={`/simulado?packId=${encodeURIComponent(pack.id)}`} className="inline-block border-2 border-[var(--pixel-primary)] bg-[var(--pixel-primary)] px-4 py-3 font-mono text-xs uppercase text-black">Abrir simulado</Link></div></article></main>;
}
