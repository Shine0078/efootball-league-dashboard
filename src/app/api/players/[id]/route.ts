import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJsonObject, requireSameOrigin, validateId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { validateAvatarUrl, validatePlayerName } from "@/lib/validation";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const guard = await requireAdmin();
    const { id: rawId } = await params;
    const id = validateId(rawId);
    const body = await readJsonObject(req);
    const data: { name?: string; avatar?: string | null } = {};

    if (body.name !== undefined) {
      const result = validatePlayerName(body.name);
      if (result.error) return jsonError(result.error, 400);
      data.name = result.value;
    }
    if (body.avatar !== undefined) {
      const result = validateAvatarUrl(body.avatar);
      if (result.error) return jsonError(result.error, 400);
      data.avatar = result.value ?? null;
    }
    if (!Object.keys(data).length) {
      return jsonError("No valid changes supplied", 400);
    }

    const existing = await prisma.player.findUnique({ where: { id }, select: { id: true, name: true, leagueId: true } });
    if (!existing) return jsonError("Player not found", 404);

    if (data.name) {
      const existingPlayers = await prisma.player.findMany({
        where: { leagueId: existing.leagueId },
        select: { id: true, name: true },
      });
      if (existingPlayers.some((player) =>
        player.id !== id && player.name.localeCompare(data.name!, undefined, { sensitivity: "accent" }) === 0
      )) {
        return jsonError("A player with that name already exists", 409);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const player = await tx.player.update({ where: { id }, data });
      await tx.auditLog.create({
        data: { actor: guard.email ?? "admin", action: "player.update", detail: `Updated ${existing.name} to ${player.name}` },
      });
      return player;
    });
    return NextResponse.json({ ok: true, player: updated });
  } catch (error) {
    return handleRouteError(error, "Failed to update player");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const guard = await requireAdmin();
    const { id: rawId } = await params;
    const id = validateId(rawId);
    const existing = await prisma.player.findUnique({ where: { id }, select: { name: true } });
    if (!existing) return jsonError("Player not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.player.delete({ where: { id } });
      await tx.auditLog.create({
        data: { actor: guard.email ?? "admin", action: "player.delete", detail: `Deleted ${existing.name} (+cascaded fixtures)` },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to delete player");
  }
}
