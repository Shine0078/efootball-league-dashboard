import { NextResponse } from "next/server";
import { handleRouteError, validateId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { computeStandings, getMostLossesPlayer } from "@/lib/standings";
import { buildBracketView, BracketRound } from "@/lib/knockout";
import { knockoutRounds } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawLeagueId = url.searchParams.get("leagueId");
    const leagueId = rawLeagueId ? validateId(rawLeagueId) : null;

    let league = null;
    if (leagueId) {
      league = await prisma.league.findUnique({ where: { id: leagueId } });
      if (!league) {
        return NextResponse.json({ error: "League not found" }, { status: 404 });
      }
    }

    const where = leagueId ? { leagueId } : { leagueId: null };
    const leagueType = league?.type ?? "normal";

    const players = await prisma.player.findMany({
      where,
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    const matches = await prisma.match.findMany({
      where,
      include: {
        homePlayer: { select: { id: true, name: true, avatar: true } },
        awayPlayer: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { playedAt: "asc" },
    });

    if (leagueType === "tournament") {
      const playerMap = new Map(
        players.map((p) => [p.id, { name: p.name, avatar: p.avatar }])
      );
      const totalRounds = knockoutRounds(players.length);
      const bracket = buildBracketView(matches, playerMap, totalRounds);
      const allLeagues = await prisma.league.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, type: true, status: true },
      });

      return NextResponse.json({
        league: league ? { id: league.id, name: league.name, type: league.type, status: league.status } : null,
        leagues: allLeagues,
        leagueType: "tournament",
        players,
        matches,
        bracket,
        lastUpdated: null,
        generatedAt: new Date().toISOString(),
        count: { players: players.length, matches: matches.length },
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const completed = matches.filter((m) => m.status === "completed");
    const latestResultAt = completed.reduce(
      (latest, match) => Math.max(latest, match.playedAt?.getTime() ?? 0),
      0
    );
    const leagueUpdatedAt = latestResultAt ? new Date(latestResultAt).toISOString() : null;
    const { rows } = computeStandings(players, completed, leagueUpdatedAt ?? undefined);
    const mostLossesPlayer = getMostLossesPlayer(matches, players);

    const allLeagues = await prisma.league.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, type: true, status: true },
    });

    return NextResponse.json({
      league: league ? { id: league.id, name: league.name, type: league.type, status: league.status } : null,
      leagues: allLeagues,
      leagueType: "normal",
      players,
      matches,
      standings: rows,
      mostLossesPlayer,
      lastUpdated: leagueUpdatedAt,
      generatedAt: new Date().toISOString(),
      count: { players: players.length, matches: matches.length },
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleRouteError(error, "Failed to load league data");
  }
}
