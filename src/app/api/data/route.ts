import { NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { computeStandings, getMostLossesPlayer, type CompletedMatchWithPlayers } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    const matches = await prisma.match.findMany({
      include: {
        homePlayer: { select: { id: true, name: true } },
        awayPlayer: { select: { id: true, name: true } },
      },
      orderBy: { playedAt: "asc" },
    });

    const completed = matches.filter(
      (match): match is typeof match & CompletedMatchWithPlayers =>
        match.status === "completed" && match.homeGoals != null && match.awayGoals != null
    );
    // BUG FIX: Keep standings fully typed and based only on completed matches.
    const { rows } = computeStandings(players, completed, new Date().toISOString());
    const mostLossesPlayer = getMostLossesPlayer(matches, players);

    const lastMatch = completed
      .map((match) => (match.playedAt ? new Date(match.playedAt).getTime() : 0))
      .reduce((acc, timestamp) => Math.max(acc, timestamp), Date.now());

    return NextResponse.json({
      players,
      matches,
      standings: rows,
      mostLossesPlayer,
      lastUpdated: new Date(lastMatch).toISOString(),
      count: { players: players.length, matches: matches.length },
    });
  } catch (error) {
    return jsonRouteError(error, "Failed to load league data");
  }
}
