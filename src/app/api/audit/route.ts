import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ logs });
}