import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Seed data uses Unsplash CDN-hosted product imagery.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
