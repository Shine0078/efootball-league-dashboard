import { NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const MAX_PLAYER_NAME_LENGTH = 60;
const MAX_AVATAR_URL_LENGTH = 2048;

type PlayerUpdateData = {
  name?: string;
  avatar?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAvatar(value: unknown): string | null | NextResponse {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    return NextResponse.json({ error: "Avatar must be a URL string" }, { status: 400 });
  }

  const avatar = value.trim();
  if (!avatar) return null;
  if (avatar.length > MAX_AVATAR_URL_LENGTH) {
    return NextResponse.json({ error: "Avatar URL is too long" }, { status: 400 });
  }

  try {
    const url = new URL(avatar);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return NextResponse.json({ error: "Avatar URL must use http or https" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Avatar must be a valid URL" }, { status: 400 });
  }

  return avatar;
}

function validatePlayerUpdate(body: unknown): PlayerUpdateData | NextResponse {
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid player payload" }, { status: 400 });
  }

  const data: PlayerUpdateData = {};
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    // BUG FIX: Reject empty or overlong player names on update.
    if (!name || name.length > MAX_PLAYER_NAME_LENGTH) {
      return NextResponse.json({ error: `Name must be 1-${MAX_PLAYER_NAME_LENGTH} characters` }, { status: 400 });
    }
    data.name = name;
  }

  if ("avatar" in body) {
    const avatar = validateAvatar(body.avatar);
    if (avatar instanceof NextResponse) return avatar;
    data.avatar = avatar;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No player fields provided" }, { status: 400 });
  }

  return data;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // BUG FIX: Require an admin session before updating player records.
    const session = await requireAdmin();
    const { id } = await params;
    const data = validatePlayerUpdate(await req.json().catch(() => null));
    if (data instanceof NextResponse) return data;

    const updated = await prisma.player.update({ where: { id }, data });
    await prisma.auditLog.create({ data: { actor: session.email ?? "admin", action: "player.update", detail: `Updated ${updated.name}` } });
    return NextResponse.json({ ok: true, player: updated });
  } catch (error) {
    return jsonRouteError(error, "Failed to update player");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // BUG FIX: Require an admin session before deleting players and cascaded fixtures.
    const session = await requireAdmin();
    const { id } = await params;
    const player = await prisma.player.findUnique({ where: { id } });
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    await prisma.player.delete({ where: { id } });
    await prisma.auditLog.create({ data: { actor: session.email ?? "admin", action: "player.delete", detail: `Deleted ${player.name} (+cascaded fixtures)` } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonRouteError(error, "Failed to delete player");
  }
}
