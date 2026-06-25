import { NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const MAX_SCORE = 99;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

function validateNullableScore(value: unknown): number | null | NextResponse {
  if (value === null) return null;
  if (validScore(value)) return value;
  return NextResponse.json({ error: `Scores must be whole numbers from 0-${MAX_SCORE}` }, { status: 400 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // BUG FIX: Require an admin session before reading or mutating match records.
    const session = await requireAdmin();
    const { id } = await params;
    const body: unknown = await req.json().catch(() => null);
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid match payload" }, { status: 400 });
    }

    const existing = await prisma.match.findUnique({
      where: { id },
      include: { homePlayer: { select: { name: true } }, awayPlayer: { select: { name: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    if (hasOwn(body, "delete") && typeof body.delete !== "boolean") {
      return NextResponse.json({ error: "Delete flag must be boolean" }, { status: 400 });
    }

    if (body.delete === true) {
      const match = await prisma.match.update({ where: { id }, data: { homeGoals: null, awayGoals: null, status: "scheduled", playedAt: null } });
      await prisma.auditLog.create({ data: { actor: session.email ?? "admin", action: "match.reset", detail: `Reset ${existing.homePlayer.name} vs ${existing.awayPlayer.name}` } });
      return NextResponse.json({ ok: true, match });
    }

    const status = body.status === undefined ? "completed" : body.status;
    if (status !== "scheduled" && status !== "completed") {
      return NextResponse.json({ error: "Status must be scheduled or completed" }, { status: 400 });
    }

    const homeValue = hasOwn(body, "homeGoals") ? body.homeGoals : existing.homeGoals;
    const awayValue = hasOwn(body, "awayGoals") ? body.awayGoals : existing.awayGoals;
    const homeGoals = validateNullableScore(homeValue);
    if (homeGoals instanceof NextResponse) return homeGoals;
    const awayGoals = validateNullableScore(awayValue);
    if (awayGoals instanceof NextResponse) return awayGoals;

    // BUG FIX: Prevent half-entered scores from creating inconsistent standings data.
    if ((homeGoals === null) !== (awayGoals === null)) {
      return NextResponse.json({ error: "Both scores are required together" }, { status: 400 });
    }

    if (status === "completed" && (homeGoals === null || awayGoals === null)) {
      return NextResponse.json({ error: "Completed matches require both scores" }, { status: 400 });
    }

    const match = await prisma.match.update({
      where: { id },
      data: status === "scheduled"
        ? { homeGoals: null, awayGoals: null, status, playedAt: null }
        : { homeGoals, awayGoals, status, playedAt: existing.playedAt ?? new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actor: session.email ?? "admin",
        action: status === "completed" ? "match.complete" : "match.update",
        detail: status === "completed"
          ? `${existing.homePlayer.name} ${homeGoals}:${awayGoals} ${existing.awayPlayer.name}`
          : `Scheduled ${existing.homePlayer.name} vs ${existing.awayPlayer.name}`,
      },
    });
    return NextResponse.json({ ok: true, match });
  } catch (error) {
    return jsonRouteError(error, "Failed to update match");
  }
}
