import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { markEmailVerified } from "../../../../lib/server/appwrite";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { expire, secret, userId } = (await request.json()) as { expire?: string; secret?: string; userId?: string };

  if (!secret) {
    return NextResponse.json({ success: false, message: "Missing session." }, { status: 400 });
  }

  if (userId) {
    await markEmailVerified(userId).catch(() => {});
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, secret, sessionCookieOptions(expire));
  return response;
}
