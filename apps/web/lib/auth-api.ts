"use client";

import { ExecutionMethod } from "appwrite";
import { appwriteFunctions } from "./appwrite";

type AuthErrorPayload = {
  success: false;
  error: string;
  message: string;
  fieldErrors?: Record<string, string>;
  remainingAttempts?: number;
  secondsRemaining?: number;
};

type AuthSuccessPayload<T> = { success: true } & T;
type AuthResponse<T> = AuthSuccessPayload<T> | AuthErrorPayload;

const functionIds = {
  signupInit: process.env.NEXT_PUBLIC_APPWRITE_FN_SIGNUP_INIT ?? "auth-signup-init",
  signupVerify: process.env.NEXT_PUBLIC_APPWRITE_FN_SIGNUP_VERIFY ?? "auth-signup-verify",
  resendOtp: process.env.NEXT_PUBLIC_APPWRITE_FN_RESEND_OTP ?? "auth-resend-otp",
  forgotPasswordInit: process.env.NEXT_PUBLIC_APPWRITE_FN_FORGOT_PASSWORD_INIT ?? "auth-forgot-password-init",
  passwordReset: process.env.NEXT_PUBLIC_APPWRITE_FN_PASSWORD_RESET ?? "auth-password-reset"
};

export class RetraceAuthError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;
  remainingAttempts?: number;
  secondsRemaining?: number;

  constructor(payload: AuthErrorPayload) {
    super(payload.message);
    this.name = "RetraceAuthError";
    this.code = payload.error;
    this.fieldErrors = payload.fieldErrors;
    this.remainingAttempts = payload.remainingAttempts;
    this.secondsRemaining = payload.secondsRemaining;
  }
}

function toAuthError(payload: Partial<AuthErrorPayload>, fallbackMessage: string) {
  return new RetraceAuthError({
    success: false,
    error: payload.error ?? "AUTH_FUNCTION_FAILED",
    message: payload.message ?? fallbackMessage,
    fieldErrors: payload.fieldErrors,
    remainingAttempts: payload.remainingAttempts,
    secondsRemaining: payload.secondsRemaining
  });
}

async function executeAuthFunction<T>(functionId: string, body: Record<string, unknown>) {
  const execution = await appwriteFunctions.createExecution({
    functionId,
    body: JSON.stringify(body),
    async: false,
    xpath: "/",
    method: ExecutionMethod.POST,
    headers: { "content-type": "application/json" }
  });

  if (execution.status !== "completed" || !execution.responseBody) {
    throw toAuthError({}, "Authentication service is unavailable. Please try again.");
  }

  let parsed: AuthResponse<T>;
  try {
    parsed = JSON.parse(execution.responseBody) as AuthResponse<T>;
  } catch {
    throw toAuthError({}, "Authentication service returned an invalid response. Please try again.");
  }

  if (!parsed.success) {
    throw toAuthError(parsed, "Authentication request failed. Please try again.");
  }

  return parsed;
}

export function signupInit(body: { name: string; email: string; password: string }) {
  return executeAuthFunction<{ message: string }>(functionIds.signupInit, body);
}

export function signupVerify(body: { email: string; otp: string }) {
  return executeAuthFunction<{ message?: string; requiresLogin?: boolean; session?: unknown }>(functionIds.signupVerify, body);
}

export function resendSignupOtp(body: { email: string }) {
  return executeAuthFunction<{ message: string }>(functionIds.resendOtp, body);
}

export function forgotPasswordInit(body: { email: string }) {
  return executeAuthFunction<{ message: string }>(functionIds.forgotPasswordInit, body);
}

export function resetPassword(body: { email: string; otp: string; newPassword: string }) {
  return executeAuthFunction<{ message: string }>(functionIds.passwordReset, body);
}
