import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJsonObject, requireSameOrigin, validateId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { advanceWinnerToNextMatch, clearAdvancementFromMatch } from "@/lib/knockout";

const MAX_SCORE = 99;

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const guard = await requireAdmin();
    const { id: rawId } = await params;
    const id = validateId(rawId);
    const body = await readJsonObject(req);

    const existing = await prisma.match.findUnique({
      where: { id },
      include: {
        homePlayer: { select: { name: true } },
        awayPlayer: { select: { name: true } },
        league: { select: { type: true } },
      },
    });
    if (!existing) return jsonError("Match not found", 404);

    const isKnockout = existing.league?.type === "tournament";

    if (body.delete === true) {
      const match = await prisma.$transaction(async (tx) => {
        const resetMatch = await tx.match.update({
          where: { id },
          data: { homeGoals: null, awayGoals: null, winnerOverride: null, status: "scheduled", playedAt: null },
        });

        if (isKnockout) {
          await clearAdvancementFromMatch(tx, id);
        }

        await tx.auditLog.create({
          data: {
            actor: guard.email ?? "admin",
            action: "match.reset",
            detail: `Reset ${existing.homePlayer?.name ?? "TBD"} vs ${existing.awayPlayer?.name ?? "TBD"}`,
          },
        });
        return resetMatch;
      });
      return NextResponse.json({ ok: true, match });
    }

    if (body.delete !== undefined && typeof body.delete !== "boolean") {
      return jsonError("Delete flag must be boolean", 400);
    }

    const homeGoals = body.homeGoals;
    const awayGoals = body.awayGoals;
    if (!validScore(homeGoals) || !validScore(awayGoals)) {
      return jsonError(`Both scores must be whole numbers from 0-${MAX_SCORE}`, 400);
    }

    if (!existing.homePlayerId || !existing.awayPlayerId) {
      return jsonError("Cannot score a match before both players are assigned", 400);
    }

    const winnerOverride = body.winnerOverride;
    if (winnerOverride != null && typeof winnerOverride !== "string") {
      return jsonError("winnerOverride must be a player id", 400);
    }
    if (winnerOverride && winnerOverride !== existing.homePlayerId && winnerOverride !== existing.awayPlayerId) {
      return jsonError("winnerOverride must be one of the match players", 400);
    }
    if (!isKnockout && winnerOverride) {
      return jsonError("winnerOverride is only valid for tournaments", 400);
    }
    if (isKnockout && homeGoals === awayGoals && !winnerOverride) {
      return jsonError("Draw requires winnerOverride", 400);
    }
    if (isKnockout && homeGoals !== awayGoals && winnerOverride) {
      return jsonError("winnerOverride is only valid for drawn knockout matches", 400);
    }

    const match = await prisma.$transaction(async (tx) => {
      const updated = await tx.match.update({
        where: { id },
        data: {
          homeGoals,
          awayGoals,
          winnerOverride: winnerOverride ?? null,
          status: "completed",
          playedAt: existing.playedAt ?? new Date(),
        },
      });

      if (isKnockout && updated.nextMatchId) {
        await advanceWinnerToNextMatch(tx, id);
      }

      await tx.auditLog.create({
        data: {
          actor: guard.email ?? "admin",
          action: existing.status === "completed" ? "match.update" : "match.complete",
          detail: `${existing.homePlayer?.name ?? "TBD"} ${homeGoals}:${awayGoals} ${existing.awayPlayer?.name ?? "TBD"}`,
        },
      });
      return updated;
    });
    return NextResponse.json({ ok: true, match });
  } catch (error) {
    return handleRouteError(error, "Failed to update match");
  }
}
