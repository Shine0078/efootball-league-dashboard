import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { jsonRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    // BUG FIX: Validate login input types and lengths before querying admin records.
    if (!email || !password || email.length > 254 || password.length > 128) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const session = await getSession();
    session.adminId = admin.id;
    session.email = admin.email;
    session.role = admin.role;
    session.isLoggedIn = true;
    await session.save();

    await prisma.auditLog.create({ data: { actor: admin.email, action: "login", detail: "Admin logged in" } });
    return NextResponse.json({ ok: true, email: admin.email, role: admin.role });
  } catch (error) {
    return jsonRouteError(error, "Failed to sign in");
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    const email = session.email;
    session.destroy();
    await session.save();
    if (email) {
      try { await prisma.auditLog.create({ data: { actor: email, action: "logout" } }); } catch {}
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonRouteError(error, "Failed to sign out");
  }
}
