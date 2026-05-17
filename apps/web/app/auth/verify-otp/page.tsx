"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { OtpInput } from "../../../components/auth/OtpInput";
import { forgotPasswordInit, resendOtp, verifySignupOtp } from "../../../lib/auth";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetMode = searchParams.get("mode") === "reset";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [otpKey, setOtpKey] = useState(0);

  useEffect(() => {
    const storageKey = resetMode ? "retrace_reset_email" : "retrace_signup_email";
    const storedEmail = sessionStorage.getItem(storageKey)?.trim().toLowerCase() ?? "";
    const storedError = resetMode ? sessionStorage.getItem("retrace_reset_error") : "";

    if (!storedEmail) {
      router.replace(resetMode ? "/auth/forgot-password" : "/auth/signup");
      return;
    }

    setEmail(storedEmail);
    if (storedError) {
      setError(storedError);
      sessionStorage.removeItem("retrace_reset_error");
    }
  }, [resetMode, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timeout = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [countdown]);

  async function handleComplete(otp: string) {
    if (!email) {
      setError("Email is missing. Please restart the flow.");
      return;
    }

    setError("");
    setIsVerifying(true);
    try {
      if (resetMode) {
        sessionStorage.setItem("retrace_reset_email", email);
        sessionStorage.setItem("retrace_reset_otp", otp);
        router.push("/auth/reset-password");
        return;
      }

      const result = await verifySignupOtp(email, otp);
      if (!result.success) {
        setError(result.message ?? "That code was not recognized. Try again.");
        return;
      }

      sessionStorage.removeItem("retrace_signup_email");
      if (result.session) {
        router.push("/");
        return;
      }

      router.push("/auth/signin?created=1");
    } catch {
      setError("That code was not recognized. Try again.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setError("");
    setResendMessage("");
    try {
      if (resetMode) {
        const result = await forgotPasswordInit(email);
        if (!result.success) {
          setError(result.message ?? "Could not resend the code.");
          return;
        }
      } else {
        const result = await resendOtp(email);
        if (!result.success) {
          if (result.error === "RESEND_COOLDOWN") {
            setCountdown(result.secondsRemaining ?? 60);
          }
          setError(result.message ?? "Could not resend the code.");
          return;
        }
      }
      setOtpKey((value) => value + 1);
      setResendMessage("Code resent.");
    } catch {
      setError("Could not resend the code.");
    }
  }

  return (
    <div className="py-10 text-center">
      <header>
        <h1 className="font-heading text-auth-heading font-semibold text-text-primary">
          {resetMode ? "Enter your reset code" : "Verify your email"}
        </h1>
        <p className="mt-2 text-base text-text-muted">
          {resetMode ? "Check your email for the 6-digit code." : "We sent a 6-digit code to your email."}
        </p>
      </header>
      <div className="mt-10">
        {email ? (
          <OtpInput
            key={otpKey}
            errorMessage={error}
            isVerifying={isVerifying}
            onComplete={handleComplete}
            onResend={handleResend}
            resendDisabled={isVerifying || countdown > 0}
            resendLabel={countdown > 0 ? `Resend (${countdown}s)` : "Resend code"}
          />
        ) : (
          <p className="text-sm text-error">Email is missing. Please restart the flow.</p>
        )}
        {resendMessage ? <p className="mt-3 text-sm text-success">{resendMessage}</p> : null}
        <Link className="mt-8 inline-block text-sm font-medium text-primary hover:underline" href={resetMode ? "/auth/forgot-password" : "/auth/signup"}>
          Start again
        </Link>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-base text-text-muted">Loading verification...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
