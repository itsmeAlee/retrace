import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./lib/auth-session";

const authPrefix = "/auth";

function isProtectedRoute(pathname: string) {
  return pathname === "/" || pathname.startsWith("/app") || pathname.startsWith("/sessions") || pathname.startsWith("/settings");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (hasSession && pathname.startsWith(authPrefix)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!hasSession && isProtectedRoute(pathname)) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/app/:path*", "/sessions/:path*", "/settings/:path*", "/auth/:path*"]
};
