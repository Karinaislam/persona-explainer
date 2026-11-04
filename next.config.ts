import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // bundling rewrites ffmpeg-static's binary path to a non-existent \ROOT\ path
  serverExternalPackages: ["ffmpeg-static", "@huggingface/transformers", "onnxruntime-node"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
