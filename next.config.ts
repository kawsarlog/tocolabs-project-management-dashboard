import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native SQLite addon must stay outside the Turbopack/webpack bundle on Vercel.
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
  ],
};

export default nextConfig;
