import { AppwriteException, ExecutionMethod } from "node-appwrite";
import { NextResponse } from "next/server";
import {
  functionIdFromEndpoint,
  publicAuthFunctionEndpoints,
  type PublicAuthFunctionKey
} from "../../../../lib/auth-functions";
import { createAdminFunctions } from "../../../../lib/server/appwrite";

export const runtime = "nodejs";

type PublicAuthFunctionRequest = {
  functionKey?: PublicAuthFunctionKey;
  body?: Record<string, unknown>;
};

function proxyError(error: unknown) {
  if (error instanceof AppwriteException) {
    return NextResponse.json(
      { success: false, error: "AUTH_FUNCTION_FAILED", message: error.message || "Auth service did not respond." },
      { status: error.code || 502 }
    );
  }

  return NextResponse.json(
    { success: false, error: "AUTH_FUNCTION_FAILED", message: "Auth service did not respond." },
    { status: 502 }
  );
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as PublicAuthFunctionRequest | null;
  const functionKey = payload?.functionKey;

  if (!functionKey || !(functionKey in publicAuthFunctionEndpoints)) {
    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: "Invalid auth request." },
      { status: 400 }
    );
  }

  try {
    const execution = await createAdminFunctions().createExecution({
      functionId: functionIdFromEndpoint(publicAuthFunctionEndpoints[functionKey]),
      body: JSON.stringify(payload.body ?? {}),
      async: false,
      xpath: "/",
      method: ExecutionMethod.POST,
      headers: { "content-type": "application/json" }
    });

    if (execution.status !== "completed" || !execution.responseBody) {
      return NextResponse.json(
        { success: false, error: "AUTH_FUNCTION_FAILED", message: "Auth service did not respond." },
        { status: 502 }
      );
    }

    return NextResponse.json(JSON.parse(execution.responseBody) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "AUTH_FUNCTION_FAILED", message: "Auth service returned an invalid response." },
        { status: 502 }
      );
    }

    return proxyError(error);
  }
}
