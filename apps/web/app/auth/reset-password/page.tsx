"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useState } from "react";
import { AuthButton } from "../../../components/auth/AuthButton";
import { AuthInput } from "../../../components/auth/AuthInput";
import { PasswordStrength } from "../../../components/auth/PasswordStrength";
import { Icon } from "../../../components/Icon";
import { verifyAndResetPassword } from "../../../lib/auth";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("retrace_reset_email")?.trim().toLowerCase() || searchParams.get("email")?.trim().toLowerCase() || "";
    const storedOtp = sessionStorage.getItem("retrace_reset_otp") ?? "";

    if (!storedEmail || !storedOtp) {
      router.replace("/auth/forgot-password");
      return;
    }

    setEmail(storedEmail);
    setOtp(storedOtp);
  }, [router, searchParams]);

  useEffect(() => {
    if (!updated) return;
    const timeout = window.setTimeout(() => router.push("/auth/signin"), 2000);
    return () => window.clearTimeout(timeout);
  }, [router, updated]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email || !otp) {
      setError("Reset code is missing. Please request a new code.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyAndResetPassword(email, otp, password);
      if (!result.success) {
        if (result.error === "OTP_EXPIRED" || result.error === "INVALID_OTP") {
          sessionStorage.setItem("retrace_reset_error", result.message ?? "Please enter your reset code again.");
          router.push("/auth/verify-otp?mode=reset");
          return;
        }
        setError(result.message ?? "Password reset failed. Please try again.");
        return;
      }
      sessionStorage.removeItem("retrace_reset_email");
      sessionStorage.removeItem("retrace_reset_otp");
      sessionStorage.removeItem("retrace_reset_error");
      setUpdated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (updated) {
    return (
      <div className="relative overflow-hidden py-10 text-center">
        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-pill text-success">
          <Icon className="h-8 w-8" name="check" />
        </div>
        <h1 className="mt-5 font-heading text-xl font-semibold text-text-primary">Password updated</h1>
        <p className="mt-2 text-base text-text-muted">Redirecting to sign in...</p>
        <motion.div
          animate={{ width: "100%" }}
          className="mt-10 h-1 rounded-pill bg-success"
          initial={{ width: "0%" }}
          transition={{ duration: reduce ? 0.2 : 2, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className="py-10">
      <header>
        <h1 className="font-heading text-auth-heading font-semibold text-text-primary">Set a new password</h1>
        <p className="mt-2 text-base text-text-muted">Choose a strong password for your account.</p>
      </header>
      <form
        className="mt-10"
        onSubmit={handleSubmit}
      >
        {error ? (
          <div className="mb-5 rounded-[6px] border-l-[3px] border-error bg-error/[0.07] px-[14px] py-3 text-[14px] text-error">
            {error}{" "}
            {!email || !otp ? (
              <Link className="font-semibold underline" href="/auth/forgot-password">
                Request a new code.
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-5">
          <div>
            <AuthInput
              id="new-password"
              disabled={isLoading}
              label="New password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              toggleVisibility
              value={password}
            />
            <PasswordStrength password={password} />
          </div>
          <AuthInput
            id="confirm-new-password"
            disabled={isLoading}
            label="Confirm new password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Password"
            toggleVisibility
            value={confirmPassword}
          />
        </div>
        <div className="mt-7">
          <AuthButton isLoading={isLoading} type="submit">Reset password</AuthButton>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-base text-text-muted">Loading reset form...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
