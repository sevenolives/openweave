import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_GIT_BRANCH: process.env.RAILWAY_GIT_BRANCH || process.env.GIT_BRANCH || 'local',
    NEXT_PUBLIC_GIT_COMMIT: (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || 'dev').substring(0, 7),
  },
};

export default nextConfig;

