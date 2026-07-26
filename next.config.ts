import type { NextConfig } from "next";

const backend =
  process.env.BACKEND_URL?.replace(/\/$/, "") || "http://127.0.0.1:9080";
const telemetry =
  process.env.TELEMETRY_URL?.replace(/\/$/, "") || "http://127.0.0.1:9081";

const nextConfig: NextConfig = {
  // Allow opening the dev app via LAN IP (phone / other devices).
  allowedDevOrigins: [
    "192.168.0.129",
    "192.168.0.129:3100",
    "127.0.0.1",
    "localhost",
  ],

  // Proxy /api to the Go backend so browsers on other LAN devices call
  // same-origin (e.g. http://192.168.x.x:3100/api/...) instead of localhost.
  // /telemetry proxies to the isolated support analytics service.
  async rewrites() {
    return [
      {
        source: "/telemetry/:path*",
        destination: `${telemetry}/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backend}/health`,
      },
    ];
  },
};

export default nextConfig;
