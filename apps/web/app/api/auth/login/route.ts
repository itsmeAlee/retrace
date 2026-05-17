import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { createAdminAccount } from "../../../../lib/server/appwrite";

export const runtime = "nodejs";

function loginError(error: unknown) {
  if (error instanceof AppwriteException) {
    if (error.code === 401) {
      return NextResponse.json({ success: false, message: "Incorrect email or password." }, { status: 401 });
    }
    if (error.code === 404) {
      return NextResponse.json({ success: false, message: "No account found with this email." }, { status: 404 });
    }
    return NextResponse.json({ success: false, message: error.message || "Could not sign in. Please try again." }, { status: error.code || 400 });
  }

  return NextResponse.json({ success: false, message: "Could not sign in. Please try again." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Enter your email and password to sign in." }, { status: 400 });
    }

    const session = await createAdminAccount().createEmailPasswordSession({
      email: email.trim().toLowerCase(),
      password
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, session.secret, sessionCookieOptions(session.expire));
    return response;
  } catch (error) {
    return loginError(error);
  }
}
