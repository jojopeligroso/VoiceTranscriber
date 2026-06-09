import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_HAS_API_KEY: process.env.OPENAI_API_KEY ? 'true' : '',
  },
};

export default nextConfig;
