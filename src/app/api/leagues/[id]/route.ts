import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      players: { orderBy: [{ order: "asc" }, { name: "asc" }] },
      _count: { select: { matches: true } },
    },
  });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
  return NextResponse.json({ league });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  const league = await prisma.league.findUnique({ where: { id }, select: { name: true, type: true } });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.league.delete({ where: { id } });
    await tx.auditLog.create({
      data: { actor: guard.email!, action: "league.delete", detail: `Deleted ${league.type} league "${league.name}"` },
    });
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { status?: unknown };

  const league = await prisma.league.findUnique({ where: { id } });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const data: { status?: string } = {};
  if (body.status === "active" || body.status === "completed" || body.status === "archived") {
    data.status = body.status;
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No valid changes" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const league = await tx.league.update({ where: { id }, data });
    await tx.auditLog.create({
      data: { actor: guard.email!, action: "league.update", detail: `Updated league "${league.name}" status to ${data.status}` },
    });
    return league;
  });

  return NextResponse.json({ ok: true, league: updated });
}