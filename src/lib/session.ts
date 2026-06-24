import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  adminId?: string;
  email?: string;
  role?: string;
  isLoggedIn: boolean;
}

const DEFAULT_SECRET =
  "dev-insecure-secret-please-change-in-production-xxxxxxxxxxxxxxxx";

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET || DEFAULT_SECRET;
  return {
    password: password.length >= 32 ? password : password.padEnd(32, "x"),
    cookieName: "efl_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

/** For use in Route Handlers (Request cookies). */
export async function getSessionFromReq() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

export async function requireAdmin(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.email) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}