import fs from "node:fs";
import path from "node:path";

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS "business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "tagline" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "supabaseUserId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "businessId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "employee_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "managerUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "employee_profile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "employee_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_profile_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "work_day" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "shiftLabel" TEXT,
    "summaryNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "work_day_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_day_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "work_entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "workDayId" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "client" TEXT,
    "orderValueUsd" REAL,
    "orderValueBdt" REAL,
    "newClients" INTEGER,
    "status" TEXT,
    "notes" TEXT,
    "extra" TEXT,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "work_entry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_entry_workDayId_fkey" FOREIGN KEY ("workDayId") REFERENCES "work_day" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_entry_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "admin_comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "workDayId" TEXT,
    "workEntryId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_comment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "admin_comment_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "admin_comment_workDayId_fkey" FOREIGN KEY ("workDayId") REFERENCES "work_day" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "admin_comment_workEntryId_fkey" FOREIGN KEY ("workEntryId") REFERENCES "work_entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL DEFAULT 'PASSWORD',
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

`;

const INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS "business_slug_key" ON "business"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "user_supabaseUserId_key" ON "user"("supabaseUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "user_businessId_username_key" ON "user"("businessId", "username");
CREATE UNIQUE INDEX IF NOT EXISTS "employee_profile_userId_key" ON "employee_profile"("userId");
CREATE INDEX IF NOT EXISTS "work_day_businessId_date_idx" ON "work_day"("businessId", "date");
CREATE INDEX IF NOT EXISTS "work_day_employeeUserId_date_idx" ON "work_day"("employeeUserId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "work_day_businessId_employeeUserId_date_key" ON "work_day"("businessId", "employeeUserId", "date");
CREATE INDEX IF NOT EXISTS "work_entry_businessId_employeeUserId_idx" ON "work_entry"("businessId", "employeeUserId");
CREATE INDEX IF NOT EXISTS "work_entry_workDayId_rowOrder_idx" ON "work_entry"("workDayId", "rowOrder");
CREATE INDEX IF NOT EXISTS "admin_comment_businessId_createdAt_idx" ON "admin_comment"("businessId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "session_tokenHash_key" ON "session"("tokenHash");
`;

type SqliteDb = {
  exec: (sql: string) => unknown;
  prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] };
  pragma: (sql: string) => unknown;
  close: () => unknown;
};

function openSqlite(filePath: string): SqliteDb {
  // Native addon — load at call time so import of this module cannot crash the route.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as new (
    filename: string,
    options?: { timeout?: number },
  ) => SqliteDb;
  return new Database(filePath, { timeout: 5000 });
}

function columnNames(db: SqliteDb, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function addColumnIfMissing(
  db: SqliteDb,
  table: string,
  column: string,
  ddl: string,
) {
  if (!columnNames(db, table).has(column)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  }
}

export function sqliteFilePathFromUrl(url: string): string {
  if (url === ":memory:") return url;
  if (url.startsWith("file://")) {
    const rest = url.slice("file://".length);
    if (rest.startsWith("/") && /^[A-Za-z]:/.test(rest.slice(1))) {
      return rest.slice(1);
    }
    return rest;
  }
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
}

export function ensureLedgerSchema(filePath: string) {
  if (filePath !== ":memory:") {
    const absolute = path.resolve(filePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
  }

  const db = openSqlite(filePath);
  try {
    db.pragma("journal_mode = WAL");
    db.exec(BOOTSTRAP_SQL);

    addColumnIfMissing(db, "business", "logoUrl", `"logoUrl" TEXT`);
    addColumnIfMissing(db, "business", "tagline", `"tagline" TEXT`);
    addColumnIfMissing(db, "work_entry", "endDate", `"endDate" DATETIME`);
    addColumnIfMissing(db, "user", "supabaseUserId", `"supabaseUserId" TEXT`);
    db.exec(INDEX_SQL);
  } finally {
    db.close();
  }
}
