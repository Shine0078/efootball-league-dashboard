import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { validatePlayerName } from "@/lib/validation";
import { generateFixturesForAll, generateKnockoutBracket, knockoutRounds } from "@/lib/fixtures";
import { autoAdvanceByes } from "@/lib/knockout";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { players: true, matches: true } } },
  });
  return NextResponse.json({ leagues });
}

export async function POST(req: Request) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  const body = await req.json().catch(() => ({})) as {
    name?: unknown;
    type?: unknown;
    players?: unknown;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "League name is required (1-100 chars)" }, { status: 400 });
  }

  const type = body.type === "knockout" ? "knockout" : "normal";

  const playerNames = Array.isArray(body.players)
    ? body.players.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
    : [];

  if (playerNames.length < 2) {
    return NextResponse.json({ error: "At least 2 players are required" }, { status: 400 });
  }
  if (playerNames.length > 64) {
    return NextResponse.json({ error: "Maximum 64 players per league" }, { status: 400 });
  }

  if (type === "knockout" && playerNames.length < 2) {
    return NextResponse.json({ error: "Knockout requires at least 2 players" }, { status: 400 });
  }

  const uniqueNames = Array.from(new Set(playerNames.map((n) => n.toLowerCase())));
  if (uniqueNames.length !== playerNames.length) {
    return NextResponse.json({ error: "Duplicate player names in league" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const league = await tx.league.create({ data: { name, type } });

    const players = [];
    for (let i = 0; i < playerNames.length; i++) {
      const nameResult = validatePlayerName(playerNames[i]);
      if (nameResult.error) throw new Error(nameResult.error);
      const player = await tx.player.create({
        data: { name: nameResult.value!, order: i, leagueId: league.id },
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
        if (m.round >= knockoutRounds(playerNames.length) - 1) continue;
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
        actor: session.email!,
        action: "league.create",
        detail: `Created ${type} league "${name}" with ${playerNames.length} players`,
      },
    });

    return { league, playersCount: playerNames.length };
  });

  return NextResponse.json({ ok: true, league: created.league });
}