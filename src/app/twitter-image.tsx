import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "56px 72px",
          background: "linear-gradient(125deg, #111827 0%, #1f2937 60%, #0f172a 100%)",
          color: "#f8fafc",
        }}
      >
        <div style={{ fontSize: 34, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 2 }}>AWS Quest</div>
        <div style={{ fontSize: 72, fontWeight: 800, marginTop: 18, lineHeight: 1.08 }}>
          Estude AWS como um jogo
        </div>
        <div style={{ fontSize: 34, marginTop: 26, color: "#cbd5e1" }}>Retro quests, progresso por XP e ranking</div>
      </div>
    ),
    size,
  );
}
