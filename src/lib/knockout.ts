import { PrismaClient, type Match } from "@prisma/client";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export function determineWinner(match: {
  homeGoals: number | null;
  awayGoals: number | null;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  status: string;
  winnerOverride?: string | null;
}): string | null {
  if (match.status === "bye") return match.homePlayerId ?? match.awayPlayerId;
  if (match.status !== "completed") return null;
  if (match.homeGoals == null || match.awayGoals == null) return null;
  if (match.homeGoals > match.awayGoals) return match.homePlayerId;
  if (match.awayGoals > match.homeGoals) return match.awayPlayerId;
  if (match.winnerOverride) return match.winnerOverride;
  return null;
}

export async function advanceWinnerToNextMatch(
  tx: TxClient,
  completedMatchId: string
): Promise<void> {
  const match = await tx.match.findUnique({ where: { id: completedMatchId } });
  if (!match) return;

  const winnerId = determineWinner(match);
  if (!winnerId) return;

  if (!match.nextMatchId) return;

  const nextMatch = await tx.match.findUnique({ where: { id: match.nextMatchId } });
  if (!nextMatch) return;

  const isHomeSlot = match.bracketPosition != null && match.bracketPosition % 2 === 0;

  const updateData: { homePlayerId?: string; awayPlayerId?: string } = {};
  if (isHomeSlot) {
    updateData.homePlayerId = winnerId;
  } else {
    updateData.awayPlayerId = winnerId;
  }

  await tx.match.update({ where: { id: nextMatch.id }, data: updateData });
}

export async function autoAdvanceByes(tx: TxClient, leagueId: string): Promise<void> {
  const byeMatches = await tx.match.findMany({
    where: { leagueId, status: "bye" },
  });

  for (const match of byeMatches) {
    const winnerId = match.homePlayerId ?? match.awayPlayerId;
    if (!winnerId || !match.nextMatchId) continue;

    const nextMatch = await tx.match.findUnique({ where: { id: match.nextMatchId } });
    if (!nextMatch) continue;

    const isHomeSlot = match.bracketPosition != null && match.bracketPosition % 2 === 0;

    await tx.match.update({
      where: { id: match.id },
      data: { status: "completed", homeGoals: winnerId === match.homePlayerId ? 1 : 0, awayGoals: winnerId === match.awayPlayerId ? 1 : 0, playedAt: new Date() },
    });

    const updateData: { homePlayerId?: string; awayPlayerId?: string } = {};
    if (isHomeSlot) {
      updateData.homePlayerId = winnerId;
    } else {
      updateData.awayPlayerId = winnerId;
    }

    await tx.match.update({ where: { id: nextMatch.id }, data: updateData });
  }
}

export interface BracketRound {
  name: string;
  round: number;
  matches: BracketMatchView[];
}

export interface BracketMatchView {
  id: string;
  round: number;
  bracketPosition: number;
  homePlayer: { id: string; name: string; avatar: string | null } | null;
  awayPlayer: { id: string; name: string; avatar: string | null } | null;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  playedAt: string | null;
  winnerOverride: string | null;
}

export function buildBracketView(
  matches: Match[],
  players: Map<string, { name: string; avatar: string | null }>,
  totalRounds: number
): BracketRound[] {
  const rounds: BracketRound[] = [];
  for (let r = 0; r < totalRounds; r++) {
    const roundMatches = matches
      .filter((m) => m.round === r)
      .sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));

    const matchViews: BracketMatchView[] = roundMatches.map((m) => ({
      id: m.id,
      round: r,
      bracketPosition: m.bracketPosition ?? 0,
      homePlayer: m.homePlayerId ? {
        id: m.homePlayerId,
        name: players.get(m.homePlayerId)?.name ?? "TBD",
        avatar: players.get(m.homePlayerId)?.avatar ?? null,
      } : null,
      awayPlayer: m.awayPlayerId ? {
        id: m.awayPlayerId,
        name: players.get(m.awayPlayerId)?.name ?? "TBD",
        avatar: players.get(m.awayPlayerId)?.avatar ?? null,
      } : null,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      status: m.status,
      playedAt: m.playedAt ? m.playedAt.toISOString() : null,
      winnerOverride: m.winnerOverride ?? null,
    }));

    rounds.push({
      name: roundNameLabel(r, totalRounds),
      round: r,
      matches: matchViews,
    });
  }
  return rounds;
}

function roundNameLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-Finals";
  if (fromEnd === 2) return "Quarter-Finals";
  return `Round ${round + 1}`;
}