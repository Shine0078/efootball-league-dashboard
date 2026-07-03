import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJsonObject, requireSameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { generateFixturesForPlayer } from "@/lib/fixtures";
import { validateAvatarUrl, validatePlayerName } from "@/lib/validation";

export async function GET() {
  try {
    const players = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    return NextResponse.json({ players });
  } catch (error) {
    return handleRouteError(error, "Failed to load players");
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const session = await requireAdmin();

    const body = await readJsonObject(req);
    const nameResult = validatePlayerName(body.name);
    if (nameResult.error) return jsonError(nameResult.error, 400);
    const avatarResult = validateAvatarUrl(body.avatar);
    if (avatarResult.error) return jsonError(avatarResult.error, 400);
    const name = nameResult.value!;
    const avatar = avatarResult.value ?? null;

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.player.findMany({ where: { leagueId: null }, orderBy: [{ order: "asc" }, { name: "asc" }] });
      if (existing.some((player) => player.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0)) {
        throw new Error("DUPLICATE_PLAYER");
      }
      const order = existing.length;
      const player = await tx.player.create({ data: { name, avatar, order, leagueId: null } });
      const fixtures = generateFixturesForPlayer(player.id, existing);
      await tx.match.createMany({ data: fixtures });
      await tx.auditLog.create({
        data: {
          actor: session.email ?? "admin",
          action: "player.create",
          detail: `Created player ${name} (+${fixtures.length} fixtures)`,
        },
      });
      return { player, fixturesCount: fixtures.length };
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "DUPLICATE_PLAYER") return null;
      throw error;
    });

    if (!created) return jsonError("A player with that name already exists", 409);
    return NextResponse.json({ ok: true, player: created.player });
  } catch (error) {
    return handleRouteError(error, "Failed to create player");
  }
}
