import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.redtickets.uy",
      },
      {
        protocol: "https",
        hostname: "api.entraste.com",
      },
      {
        protocol: "https",
        hostname: "www.entraste.com",
      },
      {
        protocol: "https",
        hostname: "redtickets.uy",
      },
    ],
  },
};

export default nextConfig;
