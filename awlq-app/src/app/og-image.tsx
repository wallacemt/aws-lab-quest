import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OgImage() {
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
          background: "linear-gradient(120deg, #0f172a 0%, #1e293b 55%, #111827 100%)",
          color: "#f8fafc",
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#f59e0b",
          }}
        >
          AWS Quest
        </div>
        <div style={{ fontSize: 78, fontWeight: 800, marginTop: 18, lineHeight: 1.08 }}>Gamificacao Retro</div>
        <div style={{ fontSize: 48, fontWeight: 700, marginTop: 10, lineHeight: 1.2 }}>
          para dominar laboratorios AWS
        </div>
        <div style={{ fontSize: 30, marginTop: 28, color: "#cbd5e1" }}>
          Quests, XP, badges, perfil e leaderboard
        </div>
      </div>
    ),
    size,
  );
}
