import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getSimuladoDifficulty } from "@/lib/simulado-difficulty";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Compartilhamento de simulado AWS Lab Quest";

export default async function OpenGraphImage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  const pack = await prisma.simuladoPack.findUnique({
    where: { id: packId },
    include: { certificationPreset: { select: { name: true, code: true } } },
  });
  const difficulty = pack ? getSimuladoDifficulty(pack.difficultyScore) : "medium";
  const labels = { easy: "FÁCIL", medium: "MÉDIO", hard: "DIFÍCIL" };
  const certification = pack?.certificationPreset?.name ?? pack?.certificationPreset?.code ?? "AWS";
  // These inline colors mirror --pixel-bg, --pixel-card, --pixel-primary and --pixel-border.
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b1220", color: "#f8fafc", fontFamily: "sans-serif", padding: 48 }}>
      {pack?.artworkUrl && <img src={pack.artworkUrl} width="430" height="534" style={{ objectFit: "cover", border: "8px solid #334155", marginRight: 40 }} />}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, border: "8px solid #334155", background: "#111827", padding: 38 }}>
        <div style={{ display: "flex", color: "#f97316", fontSize: 22, letterSpacing: 4, marginBottom: 20 }}>AWS LAB QUEST · SIMULADO</div>
        <div style={{ display: "flex", fontSize: 48, fontWeight: 700, lineHeight: 1.15, marginBottom: 24 }}>{pack?.name ?? "Simulado indisponível"}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#cbd5e1", marginBottom: 32 }}>{certification}</div>
        <div style={{ display: "flex", fontSize: 36, color: difficulty === "hard" ? "#fb7185" : difficulty === "easy" ? "#4ade80" : "#facc15", border: "4px solid #334155", padding: "14px 20px", width: "fit-content" }}>{labels[difficulty]}</div>
      </div>
    </div>,
    { ...size },
  );
}
