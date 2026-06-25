import { NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    // BUG FIX: Guard the admin audit route before any database read.
    await requireAdmin();
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ logs });
  } catch (error) {
    return jsonRouteError(error, "Failed to load audit log");
  }
}
