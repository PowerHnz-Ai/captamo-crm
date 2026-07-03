import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "ffmpeg-static"],
  async rewrites() {
    return [
      { source: "/checklist", destination: "/checklist/index.html" },
      { source: "/checklist/", destination: "/checklist/index.html" },
      { source: "/checklist/auth", destination: "/checklist/auth.html" },
    ];
  },
  async redirects() {
    return [
      { source: "/checklist", destination: "/checklist/", permanent: true },
    ];
  },
};

export default nextConfig;
