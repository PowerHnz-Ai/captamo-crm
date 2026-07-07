import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "ffmpeg-static"],
};

export default nextConfig;
