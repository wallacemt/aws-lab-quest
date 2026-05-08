import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f59e0b",
          fontSize: 48,
          fontWeight: 700,
          borderRadius: 24,
          border: "8px solid #f59e0b",
        }}
      >
        ALQ
      </div>
    ),
    size,
  );
}
