import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { createSessionAccount } from "../../../../lib/server/appwrite";
import { readSessionSecret } from "../../../../lib/server/session-cookie";

export const runtime = "nodejs";

function unauthorized() {
  const response = NextResponse.json({ success: false, message: "Please sign in again." }, { status: 401 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function POST(request: Request) {
  const session = readSessionSecret(request);

  if (!session) {
    return unauthorized();
  }

  try {
    const jwt = await createSessionAccount(session).createJWT({ duration: 900 });
    return NextResponse.json({ success: true, jwt: jwt.jwt });
  } catch {
    return unauthorized();
  }
}
