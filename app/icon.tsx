import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
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
          background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 14,
              height: 96,
              borderRadius: 8,
              background: "#3b82f6",
            }}
          />
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "#f8fafc",
              letterSpacing: -4,
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
