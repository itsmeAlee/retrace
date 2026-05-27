"use client";

import type { Models } from "appwrite";
import { OAuthProvider } from "appwrite";
import { account } from "./appwrite";
import { uiDurations } from "./app-constants";
import { clearClientAuthCache, getCurrentUser } from "./auth-client";
import type { PublicAuthFunctionKey } from "./auth-functions";
import { logError } from "./debug";

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

async function executeAuthFunction<T>(functionKey: PublicAuthFunctionKey, body: Record<string, unknown>): Promise<AuthResult<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), uiDurations.authFunctionTimeoutMs);

  try {
    const response = await fetch("/api/appwrite/auth-functions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ functionKey, body }),
      signal: controller.signal
    });

    const parsed = (await response.json().catch(() => null)) as AuthResult<T> | null;
    if (!response.ok || !parsed) {
      const failure = parsed?.success === false ? parsed : undefined;
      return {
        success: false,
        error: failure?.error ?? "AUTH_FUNCTION_FAILED",
        message: mapAuthMessage(failure?.error ?? "AUTH_FUNCTION_FAILED", failure)
      };
    }

    if (!parsed.success) {
      return {
        ...parsed,
        message: mapAuthMessage(parsed.error, parsed)
      };
    }

    return parsed;
  } catch (error) {
    logError("auth function proxy request failed", error, { functionKey });
    return {
      success: false,
      error: "AUTH_FUNCTION_FAILED",
      message: mapAuthMessage("AUTH_FUNCTION_FAILED")
    };
  } finally {
    window.clearTimeout(timeout);
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

  if (response.ok) clearClientAuthCache();
  return response.ok;
}

export function signupInit(name: string, email: string, password: string) {
  return executeAuthFunction("signupInit", { name, email, password });
}

export async function verifySignupOtp(email: string, otp: string) {
  const result = await executeAuthFunction<{ session?: unknown; requiresLogin?: boolean; message?: string }>("signupVerify", { email, otp });
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
  return executeAuthFunction("resendOtp", { email });
}

export function forgotPasswordInit(email: string) {
  return executeAuthFunction("forgotInit", { email });
}

export function verifyAndResetPassword(email: string, otp: string, newPassword: string) {
  return executeAuthFunction("forgotReset", { email, otp, newPassword });
}

export async function login(email: string, password: string) {
  clearClientAuthCache();
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = (await response.json().catch(() => null)) as { message?: string; user?: Models.User<Models.Preferences> } | null;
  if (!response.ok) {
    throw new AuthUiError(data?.message ?? "Could not sign in. Please try again.", response.status);
  }

  clearClientAuthCache();
  return data?.user ?? null;
}

export function loginWithGoogle() {
  const origin = window.location.origin;
  try {
    account.createOAuth2Token({
      provider: OAuthProvider.Google,
      success: `${origin}/api/auth/oauth/callback`,
      failure: `${origin}/auth/signin?oauth=failed`,
      scopes: ["email", "profile"]
    });
  } catch {
    window.location.assign("/auth/signin?oauth=start_failed");
  }
}

export async function logout() {
  clearClientAuthCache();
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

export async function getUser() {
  return getCurrentUser();
}
