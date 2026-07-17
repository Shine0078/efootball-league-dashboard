import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { copyFileSync, existsSync, readdirSync, statSync } from "fs";
import { basename, isAbsolute, join } from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function findBundledDatabase(root: string, maxDepth = 5): string | null {
  if (!root || !existsSync(root)) return null;

  const stack: { path: string; depth: number }[] = [{ path: root, depth: 0 }];
  while (stack.length) {
    const current = stack.pop();
    if (!current || current.depth > maxDepth) continue;

    let entries: string[];
    try {
      entries = readdirSync(current.path);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(current.path, entry);
      if (entry === "league.sqlite") return fullPath;

      try {
        if (statSync(fullPath).isDirectory() && !["node_modules", ".git"].includes(basename(fullPath))) {
          stack.push({ path: fullPath, depth: current.depth + 1 });
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  const databaseUrl = configured || "file:./data/league.sqlite";

  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  // A serverless /tmp filesystem is not persistent. Refuse to boot rather than
  // appearing to accept writes that disappear on the next cold start/deploy.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Persistent database required in production: configure TURSO_DATABASE_URL " +
      "(or a remote database with a matching Prisma provider). file: SQLite URLs " +
      "are only supported for local development and throwaway demos."
    );
  }

  // This copy-to-/tmp path is intentionally limited to non-production demo use.
  if (process.env.DATABASE_DEMO_TMP !== "true") return databaseUrl;

  const configuredPath = databaseUrl.replace(/^file:/, "");
  const sourcePath = isAbsolute(configuredPath)
    ? configuredPath
    : join(process.cwd(), configuredPath);
  const candidates = [
    sourcePath,
    join(process.cwd(), "data", "league.sqlite"),
    join(process.cwd(), "prisma", "data", "league.sqlite"),
    process.env.LAMBDA_TASK_ROOT ? join(process.env.LAMBDA_TASK_ROOT, "data", "league.sqlite") : "",
    process.env.LAMBDA_TASK_ROOT ? join(process.env.LAMBDA_TASK_ROOT, "prisma", "data", "league.sqlite") : "",
  ];
  const existingSource = candidates.find((candidate) => candidate && existsSync(candidate))
    ?? findBundledDatabase(process.env.LAMBDA_TASK_ROOT ?? process.cwd());

  const tmpPath = join("/tmp", "league-demo.sqlite");
  if (existingSource) {
    try {
      copyFileSync(existingSource, tmpPath);
    } catch {
      return databaseUrl;
    }
  }
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
