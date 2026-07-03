import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json({
      isLoggedIn: !!session.isLoggedIn,
      email: session.email ?? null,
      role: session.role ?? null,
    });
  } catch (error) {
    return handleRouteError(error, "Failed to load session");
  }
}
