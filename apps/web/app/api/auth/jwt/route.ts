import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { createSessionAccount } from "../../../../lib/server/appwrite";

export const runtime = "nodejs";

function unauthorized() {
  const response = NextResponse.json({ success: false, message: "Please sign in again." }, { status: 401 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function POST(request: Request) {
  const session = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (!session) {
    return unauthorized();
  }

  try {
    const jwt = await createSessionAccount(decodeURIComponent(session)).createJWT({ duration: 900 });
    return NextResponse.json({ success: true, jwt: jwt.jwt });
  } catch {
    return unauthorized();
  }
}
