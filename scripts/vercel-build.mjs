import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

process.env.DATABASE_URL = process.env.DATABASE_URL?.trim() || "file:./data/league.sqlite";
mkdirSync("prisma/data", { recursive: true });

const commands = [
  [process.execPath, ["node_modules/prisma/build/index.js", "db", "push"]],
  [process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/seed.ts"]],
  [process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/import-results.ts"]],
  [process.execPath, ["node_modules/next/dist/bin/next", "build"]],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
