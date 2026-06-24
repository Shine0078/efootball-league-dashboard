import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; avatar?: string | null } = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.avatar !== undefined) data.avatar = String(body.avatar).trim() || null;
  const updated = await prisma.player.update({ where: { id }, data });
  await prisma.auditLog.create({ data: { actor: guard.email!, action: "player.update", detail: `Updated ${updated.name}` } });
  return NextResponse.json({ ok: true, player: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;
  const player = await prisma.player.delete({ where: { id } }).catch(() => null);
  await prisma.auditLog.create({ data: { actor: guard.email!, action: "player.delete", detail: `Deleted ${player?.name ?? id} (+cascaded fixtures)` } });
  return NextResponse.json({ ok: true });
}