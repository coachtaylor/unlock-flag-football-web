import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Turbopack where the project root is (fixes build in mounted dirs)
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
