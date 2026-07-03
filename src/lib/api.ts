import { NextResponse } from "next/server";

export function jsonError(message: string, status = 500): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown, message: string): Response {
  if (error instanceof Response) return error;
  console.error(message, error);
  return jsonError(message, 500);
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json().catch(() => ({}));
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw jsonError("Invalid JSON payload", 400);
  }
  return body as Record<string, unknown>;
}

export function requireSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;

  const expectedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!expectedHost) return;

  const expectedProto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const expectedOrigin = `${expectedProto}://${expectedHost}`;
  if (origin !== expectedOrigin) {
    throw jsonError("Cross-origin request rejected", 403);
  }
}

export function validateId(value: string): string {
  if (!/^[a-z0-9_-]{8,64}$/i.test(value)) {
    throw jsonError("Invalid resource id", 400);
  }
  return value;
}
