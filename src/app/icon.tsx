import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#f59e0b",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: 2,
          border: "16px solid #f59e0b",
        }}
      >
        ALQ
      </div>
    ),
    size,
  );
}
