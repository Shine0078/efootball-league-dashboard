import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJsonObject, requireSameOrigin, validateId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = validateId(rawId);
    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        players: { orderBy: [{ order: "asc" }, { name: "asc" }] },
        _count: { select: { matches: true } },
      },
    });
    if (!league) return jsonError("League not found", 404);
    return NextResponse.json({ league });
  } catch (error) {
    return handleRouteError(error, "Failed to load league");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const guard = await requireAdmin();
    const { id: rawId } = await params;
    const id = validateId(rawId);

    const league = await prisma.league.findUnique({ where: { id }, select: { name: true, type: true } });
    if (!league) return jsonError("League not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.league.delete({ where: { id } });
      await tx.auditLog.create({
        data: { actor: guard.email ?? "admin", action: "league.delete", detail: `Deleted ${league.type} league "${league.name}"` },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to delete league");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const guard = await requireAdmin();
    const { id: rawId } = await params;
    const id = validateId(rawId);
    const body = await readJsonObject(req);

    const league = await prisma.league.findUnique({ where: { id } });
    if (!league) return jsonError("League not found", 404);

    const data: { status?: string } = {};
    if (body.status === "active" || body.status === "completed" || body.status === "archived") {
      data.status = body.status;
    }
    if (!Object.keys(data).length) {
      return jsonError("No valid changes", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const league = await tx.league.update({ where: { id }, data });
      await tx.auditLog.create({
        data: { actor: guard.email ?? "admin", action: "league.update", detail: `Updated league "${league.name}" status to ${data.status}` },
      });
      return league;
    });

    return NextResponse.json({ ok: true, league: updated });
  } catch (error) {
    return handleRouteError(error, "Failed to update league");
  }
}
