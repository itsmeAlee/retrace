export const SESSION_COOKIE_NAME = "retrace-session";

export function sessionCookieOptions(expires?: string | Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.RETRACE_COOKIE_SECURE === "true",
    path: "/",
    ...(expires ? { expires: new Date(expires) } : {})
  };
}
