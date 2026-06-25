import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateFixturesForAll } from "../src/lib/fixtures";

const prisma = new PrismaClient();

const DEFAULT_PLAYERS = [
  "Sam",
  "Alex",
  "Jordan",
  "Casey",
  "Riley",
  "Morgan",
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@league.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";

  // BUG FIX: Upsert keeps the admin seed idempotent across repeated runs.
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash, role: "super" },
  });
  console.log(`✓ Admin ready: ${adminEmail} (password from ADMIN_PASSWORD env)`);

  // Reset matches (wipe fixtures so seeding is idempotent)
  await prisma.match.deleteMany({});

  // Players: create if missing (preserve existing fixtures? we already wiped)
  const existing = await prisma.player.findMany();
  const names = Array.from(new Set([...DEFAULT_PLAYERS, ...existing.map((p) => p.name)]));

  const ids: string[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const found = await prisma.player.findFirst({ where: { name } });
    if (found) { ids.push(found.id); continue; }
    const p = await prisma.player.create({ data: { name, order: i } });
    ids.push(p.id);
  }
  console.log(`✓ ${ids.length} players: ${names.join(", ")}`);

  // Generate full double round-robin fixtures
  const fixtures = generateFixturesForAll(ids);
  const expectedFixtures = ids.length * (ids.length - 1);
  // BUG FIX: Assert the double round-robin fixture count before writing seed data.
  if (fixtures.length !== expectedFixtures) {
    throw new Error(`Expected ${expectedFixtures} fixtures, generated ${fixtures.length}`);
  }
  const fixtureRows: Prisma.MatchCreateManyInput[] = fixtures.map((fixture) => ({ ...fixture, status: "scheduled" }));
  await prisma.match.createMany({
    data: fixtureRows,
  });
  console.log(`✓ Generated ${fixtures.length} fixtures (${ids.length}×${ids.length - 1})`);

  await prisma.auditLog.create({ data: { actor: "seed", action: "seed", detail: `Seeded ${ids.length} players, ${fixtures.length} fixtures` } });
  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => { await prisma.$disconnect(); });
