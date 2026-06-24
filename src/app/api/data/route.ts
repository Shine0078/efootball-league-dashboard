import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  const matches = await prisma.match.findMany({
    include: {
      homePlayer: { select: { id: true, name: true } },
      awayPlayer: { select: { id: true, name: true } },
    },
    orderBy: { playedAt: "asc" },
  });

  const completed = matches.filter((m) => m.status === "completed");
  const { rows, lastUpdated } = computeStandings(players, completed as any, new Date().toISOString());

  const lastMatch = completed
    .map((m) => (m.playedAt ? new Date(m.playedAt as unknown as Date).getTime() : 0))
    .reduce((acc, t) => Math.max(acc, t), Date.now());

  return NextResponse.json({
    players,
    matches,
    standings: rows,
    lastUpdated: new Date(lastMatch).toISOString(),
    count: { players: players.length, matches: matches.length },
  });
}