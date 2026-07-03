import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ logs });
  } catch (error) {
    return handleRouteError(error, "Failed to load audit log");
  }
}
