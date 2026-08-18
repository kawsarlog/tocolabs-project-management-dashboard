import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  ensureLedgerSchema,
  sqliteFilePathFromUrl,
} from "@/lib/ledger-schema";

const VERCEL_SQLITE_PATH = "/tmp/tocolabs-ledger.db";

export function isVercelRuntime() {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

/**
 * Local Windows keeps DATABASE_URL (file:./ledger-dev.db).
 * On Vercel the bundle FS is read-only; remap file: URLs to /tmp.
 */
export function sqliteUrl() {
  const configured = process.env.DATABASE_URL?.trim();
  const vercelOverride = process.env.VERCEL_SQLITE_URL?.trim();

  if (isVercelRuntime()) {
    if (vercelOverride) return vercelOverride;
    if (!configured || configured.startsWith("file:")) {
      return `file:${VERCEL_SQLITE_PATH}`;
    }
    return configured;
  }

  if (configured) return configured;
  return "file:./prod.db";
}

function createPrismaClient() {
  const url = sqliteUrl();
  const filePath = sqliteFilePathFromUrl(url);

  try {
    ensureLedgerSchema(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ledger] failed to open/bootstrap SQLite at ${filePath}:`, error);
    throw new Error(`Ledger SQLite is not writable at ${filePath}: ${message}`);
  }

  if (isVercelRuntime()) {
    console.info(`[ledger] using SQLite at ${filePath}`);
  }

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url,
    }),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Lazy so a native-addon / read-only-FS failure is catchable in auth routes.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
