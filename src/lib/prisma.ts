import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { copyFileSync, existsSync } from "fs";
import { isAbsolute, join } from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (!configured) return "file:./prisma/data/league.sqlite";

  if (!configured.startsWith("file:") || process.env.NODE_ENV !== "production") {
    return configured;
  }

  const configuredPath = configured.replace(/^file:/, "");
  const sourcePath = isAbsolute(configuredPath)
    ? configuredPath
    : join(process.cwd(), configuredPath);
  const candidates = [
    sourcePath,
    join(process.cwd(), "data", "league.sqlite"),
    join(process.cwd(), "prisma", "data", "league.sqlite"),
  ];
  const existingSource = candidates.find((candidate) => existsSync(candidate));
  if (!existingSource) return configured;

  const tmpPath = join("/tmp", "league.sqlite");
  try { copyFileSync(existingSource, tmpPath); } catch { return configured; }
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
