import type { NextConfig } from "next";

const backend =
  process.env.BACKEND_URL?.replace(/\/$/, "") || "http://127.0.0.1:9080";

const nextConfig: NextConfig = {
  experimental: {
    // Avoid Next.js focusing the page container after client navigations (e.g. login
    // → dashboard), which draws a thin focus outline around the main content.
    appNewScrollHandler: true,
  },

  // Allow opening the dev app via LAN IP (phone / other devices).
  allowedDevOrigins: [
    "10.110.110.69",
    "10.110.110.69:3100",
    "10.80.80.220",
    "10.80.80.220:3100",
    "10.80.80.225",
    "10.80.80.225:3100",
    "192.168.0.129",
    "192.168.0.129:3100",
    "127.0.0.1",
    "localhost",
  ],

  // Proxy /api to the Go backend so browsers on other LAN devices call
  // same-origin (e.g. http://192.168.x.x:3100/api/...) instead of localhost.
  async rewrites() {
    return [
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
