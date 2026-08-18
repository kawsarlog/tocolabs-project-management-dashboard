import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

function sqliteUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Vercel serverless can write only under /tmp; local/CI can use a dummy file.
  if (process.env.VERCEL) return "file:/tmp/prod.db";
  return "file:./prod.db";
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: sqliteUrl(),
    }),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

// PrismaClient singleton to avoid exhausting connections in dev/Next hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
