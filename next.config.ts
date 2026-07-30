import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The isolated browser tests must not share the development server's build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
