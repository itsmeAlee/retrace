import { AppwriteException, ExecutionMethod } from "node-appwrite";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../lib/auth-session";
import { createAdminFunctions, createSessionAccount } from "../../../../lib/server/appwrite";
import { readSessionSecret } from "../../../../lib/server/session-cookie";

export const runtime = "nodejs";

type FunctionProxyBody = {
  functionId?: string;
  method?: string;
  body?: Record<string, unknown>;
  query?: Record<string, string | number | undefined>;
};

const allowedMethods = new Set<string>(Object.values(ExecutionMethod));

function unauthorized() {
  const response = NextResponse.json({ success: false, error: "UNAUTHORIZED", message: "Please sign in again." }, { status: 401 });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

function toPath(query?: FunctionProxyBody["query"]) {
  const queryString = query
    ? new URLSearchParams(
        Object.entries(query)
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([key, value]) => [key, String(value)])
      ).toString()
    : "";

  return queryString ? `/?${queryString}` : "/";
}

function executionError(error: unknown) {
  if (error instanceof AppwriteException) {
    return NextResponse.json(
      {
        success: false,
        error: "FUNCTION_EXECUTION_FAILED",
        message: error.message || "The sessions service did not respond."
      },
      { status: error.code || 502 }
    );
  }

  return NextResponse.json(
    { success: false, error: "FUNCTION_EXECUTION_FAILED", message: "The sessions service did not respond." },
    { status: 502 }
  );
}

export async function POST(request: Request) {
  const session = readSessionSecret(request);

  if (!session) {
    return unauthorized();
  }

  let jwt: string;
  try {
    const created = await createSessionAccount(session).createJWT({ duration: 900 });
    jwt = created.jwt;
  } catch {
    return unauthorized();
  }

  const payload = (await request.json().catch(() => null)) as FunctionProxyBody | null;
  const method = payload?.method ?? ExecutionMethod.POST;

  if (!payload?.functionId || !allowedMethods.has(method)) {
    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: "Invalid function execution request." },
      { status: 400 }
    );
  }

  try {
    const execution = await createAdminFunctions().createExecution({
      functionId: payload.functionId,
      body: payload.body ? JSON.stringify(payload.body) : "",
      async: false,
      xpath: toPath(payload.query),
      method: method as ExecutionMethod,
      headers: {
        authorization: `Bearer ${jwt}`,
        "x-retrace-jwt": jwt,
        "content-type": "application/json"
      }
    });

    if (execution.status !== "completed" || !execution.responseBody) {
      return NextResponse.json(
        { success: false, error: "FUNCTION_EXECUTION_FAILED", message: "The sessions service did not respond." },
        { status: 502 }
      );
    }

    const responseBody = JSON.parse(execution.responseBody) as unknown;
    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "FUNCTION_EXECUTION_FAILED", message: "The sessions service returned an invalid response." },
        { status: 502 }
      );
    }

    return executionError(error);
  }
}
