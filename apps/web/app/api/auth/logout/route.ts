import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { createSessionAccount } from "../../../../lib/server/appwrite";
import { readSessionSecret } from "../../../../lib/server/session-cookie";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = readSessionSecret(request);

  if (session) {
    await createSessionAccount(session).deleteSession({ sessionId: "current" }).catch(() => {});
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
