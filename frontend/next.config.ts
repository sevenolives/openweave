import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_GIT_BRANCH: process.env.RAILWAY_GIT_BRANCH || process.env.GIT_BRANCH || 'local',
    NEXT_PUBLIC_GIT_COMMIT: (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || 'dev').substring(0, 7),
    NEXT_PUBLIC_FREE_MAX_USERS: process.env.FREE_MAX_USERS || '5',
    NEXT_PUBLIC_FREE_MAX_WORKSPACES: process.env.FREE_MAX_WORKSPACES || '1',
    NEXT_PUBLIC_FREE_MAX_PROJECTS: process.env.FREE_MAX_PROJECTS || '5',
    NEXT_PUBLIC_FREE_MAX_BOT_AGENTS: process.env.FREE_MAX_BOT_AGENTS || '2',
    NEXT_PUBLIC_PRO_MONTHLY_PRICE: process.env.PRO_MONTHLY_PRICE || '12',
    NEXT_PUBLIC_PRO_ANNUAL_PRICE: process.env.PRO_ANNUAL_PRICE || '10',
  },
};

export default nextConfig;

