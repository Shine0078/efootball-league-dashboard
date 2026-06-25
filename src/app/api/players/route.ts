import { NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { generateFixturesForPlayer } from "@/lib/fixtures";

const MAX_PLAYER_NAME_LENGTH = 60;
const MAX_AVATAR_URL_LENGTH = 2048;

type PlayerInput = {
  name: string;
  avatar: string | null;
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

function validatePlayerInput(body: unknown): PlayerInput | NextResponse {
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  // BUG FIX: Validate player name length before writing client input to the database.
  if (!name || name.length > MAX_PLAYER_NAME_LENGTH) {
    return NextResponse.json({ error: `Name must be 1-${MAX_PLAYER_NAME_LENGTH} characters` }, { status: 400 });
  }

  const avatar = validateAvatar(body.avatar);
  if (avatar instanceof NextResponse) return avatar;

  return { name, avatar };
}

export async function GET() {
  try {
    const players = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    return NextResponse.json({ players });
  } catch (error) {
    return jsonRouteError(error, "Failed to load players");
  }
}

export async function POST(req: Request) {
  try {
    // BUG FIX: Require an admin session before creating players or fixtures.
    const session = await requireAdmin();
    const input = validatePlayerInput(await req.json().catch(() => null));
    if (input instanceof NextResponse) return input;

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
      const order = existing.length;
      const player = await tx.player.create({ data: { name: input.name, avatar: input.avatar, order } });
      const fixtures = generateFixturesForPlayer(player.id, existing);
      await tx.match.createMany({ data: fixtures });
      return { player, fixturesCount: fixtures.length };
    });

    await prisma.auditLog.create({
      data: { actor: session.email ?? "admin", action: "player.create", detail: `Created player ${input.name} (+${created.fixturesCount} fixtures)` },
    });
    return NextResponse.json({ ok: true, player: created.player });
  } catch (error) {
    return jsonRouteError(error, "Failed to create player");
  }
}
