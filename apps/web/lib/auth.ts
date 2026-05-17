"use client";

import type { Models } from "appwrite";
import { ExecutionMethod } from "appwrite";
import { functions } from "./appwrite";

type ErrorCode =
  | "EMAIL_EXISTS"
  | "RESEND_COOLDOWN"
  | "OTP_EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "INVALID_OTP"
  | "NO_PENDING_SIGNUP"
  | "NO_RESET_REQUEST"
  | "RESET_FAILED"
  | "PROFILE_CREATION_FAILED"
  | "VALIDATION_ERROR"
  | "AUTH_FUNCTION_FAILED";

type AuthFailure = {
  success: false;
  error?: ErrorCode | string;
  message?: string;
  fieldErrors?: Record<string, string>;
  remainingAttempts?: number;
  secondsRemaining?: number;
};

type AuthSuccess<T = Record<string, unknown>> = {
  success: true;
} & T;

export type AuthResult<T = Record<string, unknown>> = AuthSuccess<T> | AuthFailure;

type MessageData = {
  success: boolean;
  error?: ErrorCode | string;
  message?: string;
  fieldErrors?: Record<string, string>;
  remainingAttempts?: number;
  secondsRemaining?: number;
};

export class AuthUiError extends Error {
  code?: string | number;

  constructor(message: string, code?: string | number) {
    super(message);
    this.name = "AuthUiError";
    this.code = code;
  }
}

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";

const functionEndpoints = {
  signupInit: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SIGNUP_INIT ?? `${endpoint}/functions/auth-signup-init/executions`,
  signupVerify: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SIGNUP_VERIFY ?? `${endpoint}/functions/auth-signup-verify/executions`,
  resendOtp: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_RESEND_OTP ?? `${endpoint}/functions/auth-resend-otp/executions`,
  forgotInit: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_FORGOT_INIT ?? `${endpoint}/functions/auth-forgot-password-init/executions`,
  forgotReset: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_FORGOT_RESET ?? `${endpoint}/functions/auth-password-reset/executions`
};

function functionIdFromEndpoint(functionEndpoint: string) {
  const match = functionEndpoint.match(/\/functions\/([^/]+)\/executions\/?$/);
  return match ? decodeURIComponent(match[1]) : functionEndpoint;
}

function mapAuthMessage(code?: string, data: Partial<MessageData> = {}) {
  switch (code) {
    case "EMAIL_EXISTS":
      return "An account with this email already exists.";
    case "RESEND_COOLDOWN":
      return `Please wait ${data.secondsRemaining ?? 60}s before resending.`;
    case "OTP_EXPIRED":
      return "Your code expired. Request a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many attempts. Please restart.";
    case "INVALID_OTP":
      return `Incorrect code. ${data.remainingAttempts ?? 0} attempts left.`;
    case "NO_PENDING_SIGNUP":
      return "Session expired. Please sign up again.";
    case "NO_RESET_REQUEST":
      return "Request expired. Please try again.";
    case "RESET_FAILED":
      return "Could not reset password. Please try again.";
    case "PROFILE_CREATION_FAILED":
      return "Signup failed. Please try again.";
    case "VALIDATION_ERROR":
      return data.message ?? "Please check the highlighted fields.";
    default:
      return data.message ?? "Something went wrong. Please try again.";
  }
}

async function executeAuthFunction<T>(functionEndpoint: string, body: Record<string, unknown>): Promise<AuthResult<T>> {
  try {
    const execution = await functions.createExecution({
      functionId: functionIdFromEndpoint(functionEndpoint),
      body: JSON.stringify(body),
      async: false,
      xpath: "/",
      method: ExecutionMethod.POST,
      headers: { "content-type": "application/json" }
    });

    if (execution.status !== "completed" || !execution.responseBody) {
      return {
        success: false,
        error: "AUTH_FUNCTION_FAILED",
        message: mapAuthMessage("AUTH_FUNCTION_FAILED")
      };
    }

    const parsed = JSON.parse(execution.responseBody) as AuthResult<T>;
    if (!parsed.success) {
      return {
        ...parsed,
        message: mapAuthMessage(parsed.error, parsed)
      };
    }

    return parsed;
  } catch {
    return {
      success: false,
      error: "AUTH_FUNCTION_FAILED",
      message: mapAuthMessage("AUTH_FUNCTION_FAILED")
    };
  }
}

async function adoptReturnedSession(session: unknown) {
  if (!session || typeof session !== "object") {
    return false;
  }

  const maybeSession = session as { userId?: string; user_id?: string; secret?: string; expire?: string };
  const userId = maybeSession.userId ?? maybeSession.user_id;
  if (!userId || !maybeSession.secret) {
    return false;
  }

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: maybeSession.secret, expire: maybeSession.expire })
  });

  return response.ok;
}

export function signupInit(name: string, email: string, password: string) {
  return executeAuthFunction(functionEndpoints.signupInit, { name, email, password });
}

export async function verifySignupOtp(email: string, otp: string) {
  const result = await executeAuthFunction<{ session?: unknown; requiresLogin?: boolean; message?: string }>(functionEndpoints.signupVerify, { email, otp });
  if (result.success && result.session) {
    const adopted = await adoptReturnedSession(result.session).catch(() => false);
    if (!adopted) {
      return {
        ...result,
        session: undefined,
        requiresLogin: true,
        message: "Account created. Please sign in."
      };
    }
  }
  return result;
}

export function resendOtp(email: string) {
  return executeAuthFunction(functionEndpoints.resendOtp, { email });
}

export function forgotPasswordInit(email: string) {
  return executeAuthFunction(functionEndpoints.forgotInit, { email });
}

export function verifyAndResetPassword(email: string, otp: string, newPassword: string) {
  return executeAuthFunction(functionEndpoints.forgotReset, { email, otp, newPassword });
}

export async function login(email: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = (await response.json().catch(() => null)) as { message?: string; user?: Models.User<Models.Preferences> } | null;
  if (!response.ok) {
    throw new AuthUiError(data?.message ?? "Could not sign in. Please try again.", response.status);
  }

  return data?.user ?? null;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

export async function getUser() {
  const response = await fetch("/api/auth/me", { method: "GET" }).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as { user?: Models.User<Models.Preferences> } | null;
  return data?.user ?? null;
}
