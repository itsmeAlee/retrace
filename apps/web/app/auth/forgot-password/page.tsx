"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthButton } from "../../../components/auth/AuthButton";
import { AuthInput } from "../../../components/auth/AuthInput";
import { Icon } from "../../../components/Icon";
import { forgotPasswordInit } from "../../../lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await forgotPasswordInit(normalizedEmail);
      if (!result.success) {
        setError(result.message ?? "Could not send a reset code.");
        return;
      }
      sessionStorage.setItem("retrace_reset_email", normalizedEmail);
      sessionStorage.removeItem("retrace_reset_otp");
      setEmail(normalizedEmail);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a reset code.");
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    async function handleResend() {
      setError("");
      setIsLoading(true);
      try {
        const result = await forgotPasswordInit(email);
        if (!result.success) {
          setError(result.message ?? "Could not resend the reset code.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    return (
      <div className="py-10 text-center">
        <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-pill text-success">
          <Icon className="h-8 w-8" name="check" />
        </div>
        <h1 className="mt-5 font-heading text-xl font-semibold text-text-primary">Check your email</h1>
        <p className="mt-2 text-base text-text-muted">A 6-digit code was sent to {email}.</p>
        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
        <p className="mt-5 text-sm text-text-muted">
          Didn&apos;t receive it?{" "}
          <button className="font-medium text-primary disabled:text-text-muted/70" disabled={isLoading} onClick={handleResend} type="button">
            Resend
          </button>
        </p>
        <Link className="mt-7 inline-flex h-auth-control items-center justify-center rounded-form bg-primary px-6 text-base font-medium text-white" href="/auth/verify-otp?mode=reset">
          Enter reset code
        </Link>
      </div>
    );
  }

  return (
    <div className="py-10">
      <Link className="mb-12 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href="/auth/signin">
        <Icon className="h-4 w-4" name="arrow-left" />
        Back to sign in
      </Link>
      <header>
        <h1 className="font-heading text-auth-heading font-semibold text-text-primary">Forgot your password?</h1>
        <p className="mt-2 text-base text-text-muted">Enter your email and we&apos;ll send you a reset code.</p>
      </header>
      <form
        className="mt-10"
        onSubmit={handleSubmit}
      >
        {error ? (
          <div className="mb-5 rounded-[6px] border-l-[3px] border-error bg-error/[0.07] px-[14px] py-3 text-[14px] text-error">
            {error}
          </div>
        ) : null}
        <AuthInput disabled={isLoading} id="email" label="Email" onChange={(event) => setEmail(event.target.value)} placeholder="scholar@retrace.io" type="email" value={email} />
        <div className="mt-7">
          <AuthButton isLoading={isLoading} type="submit">Send reset code</AuthButton>
        </div>
      </form>
    </div>
  );
}
