import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { createSessionAccount } from "../../../../lib/server/appwrite";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (session) {
    await createSessionAccount(decodeURIComponent(session)).deleteSession({ sessionId: "current" }).catch(() => {});
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
