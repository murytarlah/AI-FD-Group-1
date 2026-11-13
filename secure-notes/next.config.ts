import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Auth pages depend on the current request; keep component caching disabled.
  cacheComponents: false,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
