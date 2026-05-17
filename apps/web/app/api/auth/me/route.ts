import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { createSessionAccount } from "../../../../lib/server/appwrite";

export const runtime = "nodejs";

function unauthorized() {
  const response = NextResponse.json({ success: false, user: null }, { status: 401 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
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
    const user = await createSessionAccount(decodeURIComponent(session)).get();
    return NextResponse.json({ success: true, user });
  } catch {
    return unauthorized();
  }
}
