import { NextResponse } from "next/server";

export function jsonRouteError(error: unknown, message: string): Response {
  if (error instanceof Response) return error;

  console.error(message, error);
  // BUG FIX: API routes return structured 500 JSON instead of leaking unhandled exceptions.
  return NextResponse.json({ error: message }, { status: 500 });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}
