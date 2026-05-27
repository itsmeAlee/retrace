import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { createSessionAccount, ensureEmailVerified } from "../../../../lib/server/appwrite";
import { readSessionSecret } from "../../../../lib/server/session-cookie";

export const runtime = "nodejs";

function unauthorized() {
  const response = NextResponse.json({ success: false, user: null }, { status: 401 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const session = readSessionSecret(request);

  if (!session) {
    return unauthorized();
  }

  try {
    const user = await createSessionAccount(session).get();
    const verifiedUser = await ensureEmailVerified(user).catch(() => user);
    return NextResponse.json({ success: true, user: verifiedUser });
  } catch {
    return unauthorized();
  }
}
