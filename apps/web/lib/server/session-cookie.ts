import "server-only";

import { SESSION_COOKIE_NAME } from "../auth-session";

export function readSessionSecret(request: Request) {
  const session = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  return session ? decodeURIComponent(session) : null;
}
