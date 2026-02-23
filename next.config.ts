import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "iiwsgivctcqlfqabytxp.supabase.co",
      },
    ],
  },
  productionBrowserSourceMaps: false,
  // Prevent Next.js from bundling ffmpeg-static binary into the serverless function
  serverExternalPackages: ["ffmpeg-static", "pg"],
};

export default nextConfig;
