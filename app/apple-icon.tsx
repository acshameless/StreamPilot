import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
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
          background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 12,
              height: 88,
              borderRadius: 6,
              background: "#3b82f6",
            }}
          />
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              color: "#f8fafc",
              letterSpacing: -3,
              lineHeight: 1,
            }}
          >
            直
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
