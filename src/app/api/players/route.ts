import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJsonObject, requireSameOrigin, validateId } from "@/lib/api";
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
    const leagueId = body.leagueId === null || body.leagueId === undefined
      ? null
      : typeof body.leagueId === "string" ? validateId(body.leagueId) : null;
    if (body.leagueId !== null && body.leagueId !== undefined && !leagueId) {
      return jsonError("leagueId must be a valid id or null", 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      if (leagueId) {
        const league = await tx.league.findUnique({ where: { id: leagueId }, select: { id: true, type: true } });
        if (!league) throw new Error("LEAGUE_NOT_FOUND");
        if (league.type === "tournament") throw new Error("TOURNAMENT_PLAYERS_LOCKED");
      }
      const existing = await tx.player.findMany({ where: { leagueId }, orderBy: [{ order: "asc" }, { name: "asc" }] });
      if (existing.some((player) => player.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0)) {
        throw new Error("DUPLICATE_PLAYER");
      }
      const order = existing.length;
      const player = await tx.player.create({ data: { name, avatar, order, leagueId } });
      const fixtures = generateFixturesForPlayer(player.id, existing);
      await tx.match.createMany({ data: fixtures.map((fixture) => ({ ...fixture, leagueId })) });
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
      if (error instanceof Error && error.message === "LEAGUE_NOT_FOUND") return "LEAGUE_NOT_FOUND" as const;
      if (error instanceof Error && error.message === "TOURNAMENT_PLAYERS_LOCKED") return "TOURNAMENT_PLAYERS_LOCKED" as const;
      throw error;
    });

    if (!created) return jsonError("A player with that name already exists", 409);
    if (created === "LEAGUE_NOT_FOUND") return jsonError("League not found", 404);
    if (created === "TOURNAMENT_PLAYERS_LOCKED") return jsonError("Tournament players are fixed when the bracket is created", 409);
    return NextResponse.json({ ok: true, player: created.player });
  } catch (error) {
    return handleRouteError(error, "Failed to create player");
  }
}
