import type { Models } from "node-appwrite";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../../lib/auth-session";
import { appwriteServerConfig } from "../../../../../lib/server/appwrite";

export const runtime = "nodejs";

function redirectToSignIn(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/auth/signin?oauth=${reason}`, request.url));
}

async function appwriteFetch<T>(path: string, init: RequestInit) {
  const response = await fetch(`${appwriteServerConfig.endpoint}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-appwrite-project": appwriteServerConfig.projectId,
      "x-appwrite-key": appwriteServerConfig.apiKey,
      ...init.headers
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Appwrite request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function markEmailVerified(userId: string) {
  return appwriteFetch(`/users/${encodeURIComponent(userId)}/verification`, {
    method: "PATCH",
    body: JSON.stringify({ emailVerification: true })
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");

  if (!userId || !secret) {
    return redirectToSignIn(request, "missing");
  }

  try {
    const session = await appwriteFetch<Models.Session>("/account/sessions/token", {
      method: "POST",
      body: JSON.stringify({ userId, secret })
    });

    if (!session.secret) {
      return redirectToSignIn(request, "session");
    }

    await markEmailVerified(session.userId).catch(() => undefined);

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(SESSION_COOKIE_NAME, session.secret, sessionCookieOptions(session.expire));
    return response;
  } catch {
    return redirectToSignIn(request, "session");
  }
}
