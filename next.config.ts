import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/zxing_reader.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }],
      },
    ];
  },
};

export default nextConfig;
