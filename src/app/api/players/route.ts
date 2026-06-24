import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateFixturesForPlayer } from "@/lib/fixtures";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  return NextResponse.json({ players });
}

export async function POST(req: Request) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  const avatar = (body.avatar as string | undefined)?.trim() || null;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // auto-generate fixtures for this new player against existing players
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    const order = existing.length;
    const player = await tx.player.create({ data: { name, avatar, order } });
    const fixtures = generateFixturesForPlayer(player.id, existing);
    await tx.match.createMany({ data: fixtures });
    return { player, fixturesCount: fixtures.length };
  });

  await prisma.auditLog.create({
    data: { actor: session.email!, action: "player.create", detail: `Created player ${name} (+${created.fixturesCount} fixtures)` },
  });
  return NextResponse.json({ ok: true, player: created.player });
}