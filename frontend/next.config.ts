import type { NextConfig } from "next";

const API = process.env.ALTER_API_ORIGIN || "http://127.0.0.1:4000";
const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
try {
  if (R2) {
    const u = new URL(R2);
    remotePatterns.push({
      protocol: u.protocol.replace(":", "") as "http" | "https",
      hostname: u.hostname,
      pathname: "/**",
    });
  }
} catch {
  /* ignore bad URL */
}

const nextConfig: NextConfig = {
  compress: true,
  images: {
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/:path*.(js|css|woff2|png|jpg|jpeg|webp|svg|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
