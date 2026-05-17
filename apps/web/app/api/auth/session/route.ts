import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { secret, expire } = (await request.json()) as { secret?: string; expire?: string };

  if (!secret) {
    return NextResponse.json({ success: false, message: "Missing session." }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, secret, sessionCookieOptions(expire));
  return response;
}
