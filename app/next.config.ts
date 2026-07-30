import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone with a minimal server bundle — this is what the
  // Dockerfile copies into the runtime image.
  output: "standalone",
  poweredByHeader: false,
  eslint: {
    // Lint runs as its own CI step; don't fail the container build on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
