import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { determineWinner, advanceWinnerToNextMatch } from "@/lib/knockout";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

function validScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    homeGoals?: number;
    awayGoals?: number;
    status?: string;
    delete?: boolean;
    winnerOverride?: string | null;
  };

  const existing = await prisma.match.findUnique({
    where: { id },
    include: {
      homePlayer: { select: { name: true } },
      awayPlayer: { select: { name: true } },
      league: { select: { type: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const isKnockout = existing.league?.type === "knockout";

  if (body.delete === true) {
    const m = await prisma.$transaction(async (tx) => {
      const match = await tx.match.update({
        where: { id },
        data: { homeGoals: null, awayGoals: null, winnerOverride: null, status: "scheduled", playedAt: null },
      });

      if (match.nextMatchId) {
        const nextMatch = await tx.match.findUnique({ where: { id: match.nextMatchId } });
        if (nextMatch) {
          const isHomeSlot = match.bracketPosition != null && match.bracketPosition % 2 === 0;
          if (isHomeSlot) {
            await tx.match.update({ where: { id: nextMatch.id }, data: { homePlayerId: null, homeGoals: null, awayGoals: null, status: "scheduled", playedAt: null } });
          } else {
            await tx.match.update({ where: { id: nextMatch.id }, data: { awayPlayerId: null, homeGoals: null, awayGoals: null, status: "scheduled", playedAt: null } });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          actor: guard.email!,
          action: "match.reset",
          detail: `Reset ${existing.homePlayer?.name ?? "TBD"} vs ${existing.awayPlayer?.name ?? "TBD"}`,
        },
      });
      return match;
    });
    return NextResponse.json({ ok: true, match: m });
  }

  const homeGoals = body.homeGoals;
  const awayGoals = body.awayGoals;
  if (!validScore(homeGoals) || !validScore(awayGoals)) {
    return NextResponse.json({ error: "Both scores must be non-negative integers" }, { status: 400 });
  }

  if (isKnockout && homeGoals === awayGoals && !body.winnerOverride) {
    return NextResponse.json({ error: "Draw requires winnerOverride" }, { status: 400 });
  }

  const m = await prisma.$transaction(async (tx) => {
    const match = await tx.match.update({
      where: { id },
      data: {
        homeGoals,
        awayGoals,
        winnerOverride: body.winnerOverride ?? null,
        status: "completed",
        playedAt: existing.playedAt ?? new Date(),
      },
    });

    if (isKnockout && match.nextMatchId) {
      await advanceWinnerToNextMatch(tx, id);
    }

    await tx.auditLog.create({
      data: {
        actor: guard.email!,
        action: existing.status === "completed" ? "match.update" : "match.complete",
        detail: `${existing.homePlayer?.name ?? "TBD"} ${homeGoals}:${awayGoals} ${existing.awayPlayer?.name ?? "TBD"}`,
      },
    });
    return match;
  });
  return NextResponse.json({ ok: true, match: m });
}