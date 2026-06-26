import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { copyFileSync, existsSync } from "fs";
import { join } from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (!configured) return "file:./prisma/data/league.sqlite";

  if (!configured.startsWith("file:") || process.env.NODE_ENV !== "production") {
    return configured;
  }

  const sourcePath = configured.replace(/^file:/, "");
  if (!existsSync(sourcePath)) {
    const altSource = join(process.cwd(), "prisma", "data", "league.sqlite");
    if (existsSync(altSource)) {
      const tmpPath = join("/tmp", "league.sqlite");
      try { copyFileSync(altSource, tmpPath); } catch { return configured; }
      return `file:${tmpPath}`;
    }
    return configured;
  }

  const tmpPath = join("/tmp", "league.sqlite");
  try { copyFileSync(sourcePath, tmpPath); } catch { return configured; }
  return `file:${tmpPath}`;
}

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN;
  const adapter = tursoUrl
    ? new PrismaLibSQL({ url: tursoUrl, authToken: tursoAuthToken })
    : undefined;

  const databaseUrl = adapter ? undefined : resolveDatabaseUrl();

  return new PrismaClient({
    ...(adapter
      ? { adapter }
      : databaseUrl
        ? { datasources: { db: { url: databaseUrl } } }
        : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
