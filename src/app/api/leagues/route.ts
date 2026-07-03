import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJsonObject, requireSameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { validatePlayerName } from "@/lib/validation";
import { generateFixturesForAll, generateKnockoutBracket, knockoutRounds } from "@/lib/fixtures";
import { autoAdvanceByes } from "@/lib/knockout";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const leagues = await prisma.league.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { players: true, matches: true } } },
    });
    return NextResponse.json({ leagues });
  } catch (error) {
    return handleRouteError(error, "Failed to load leagues");
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const session = await requireAdmin();
    const body = await readJsonObject(req);

    const name = typeof body.name === "string" ? body.name.normalize("NFC").trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 100) {
      return jsonError("League name is required (1-100 chars)", 400);
    }

    const type = body.type === "tournament" ? "tournament" : "normal";

    const playerNames = Array.isArray(body.players)
      ? body.players.map(validatePlayerName)
      : [];

    const invalidPlayer = playerNames.find((result) => result.error);
    if (invalidPlayer?.error) return jsonError(invalidPlayer.error, 400);
    const normalizedNames = playerNames.flatMap((result) => result.value ? [result.value] : []);

    if (normalizedNames.length < 2) {
      return jsonError("At least 2 players are required", 400);
    }
    if (normalizedNames.length > 64) {
      return jsonError("Maximum 64 players per league", 400);
    }

    const uniqueNames = new Set(normalizedNames.map((playerName) => playerName.toLocaleLowerCase()));
    if (uniqueNames.size !== normalizedNames.length) {
      return jsonError("Duplicate player names in league", 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      const league = await tx.league.create({ data: { name, type } });

      const players = [];
      for (let i = 0; i < normalizedNames.length; i++) {
        const player = await tx.player.create({
          data: { name: normalizedNames[i], order: i, leagueId: league.id },
        });
        players.push(player);
      }

      if (type === "normal") {
        const fixtures = generateFixturesForAll(players.map((p) => p.id));
        await tx.match.createMany({
          data: fixtures.map((f) => ({ ...f, leagueId: league.id })),
        });
      } else {
        const bracket = generateKnockoutBracket(players.map((p) => p.id));
        const createdMatches: { round: number; bracketPosition: number; id: string }[] = [];

        for (const m of bracket) {
          const match = await tx.match.create({
            data: {
              homePlayerId: m.homePlayerId,
              awayPlayerId: m.awayPlayerId,
              homeGoals: null,
              awayGoals: null,
              status: m.status,
              leg: m.leg,
              leagueId: league.id,
              round: m.round,
              bracketPosition: m.bracketPosition,
            },
          });
          createdMatches.push({ round: m.round, bracketPosition: m.bracketPosition, id: match.id });
        }

        for (const m of createdMatches) {
          if (m.round >= knockoutRounds(normalizedNames.length) - 1) continue;
          const nextPosition = Math.floor(m.bracketPosition / 2);
          const nextMatch = createdMatches.find(
            (nm) => nm.round === m.round + 1 && nm.bracketPosition === nextPosition
          );
          if (nextMatch) {
            await tx.match.update({ where: { id: m.id }, data: { nextMatchId: nextMatch.id } });
          }
        }

        await autoAdvanceByes(tx, league.id);
      }

      await tx.auditLog.create({
        data: {
          actor: session.email ?? "admin",
          action: "league.create",
          detail: `Created ${type} league "${name}" with ${normalizedNames.length} players`,
        },
      });

      return { league, playersCount: normalizedNames.length };
    });

    return NextResponse.json({ ok: true, league: created.league });
  } catch (error) {
    return handleRouteError(error, "Failed to create league");
  }
}
