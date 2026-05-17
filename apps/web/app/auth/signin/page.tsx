"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthButton } from "../../../components/auth/AuthButton";
import { AuthDivider } from "../../../components/auth/AuthDivider";
import { AuthInput } from "../../../components/auth/AuthInput";
import { login, loginWithGoogle } from "../../../lib/auth";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.5.2 24 .2 14.7.2 6.7 5.5 2.8 13.3l7.9 6.1C12.6 13.6 17.9 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M47.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.6h13c-.6 2.8-2.2 5.3-4.7 6.9l7.3 5.7c4.3-4 7.5-9.8 7.5-16.7Z" />
      <path fill="#FBBC05" d="M10.7 28.6a14.6 14.6 0 0 1 0-9.2l-7.9-6.1a24 24 0 0 0 0 21.4l7.9-6.1Z" />
      <path fill="#34A853" d="M24 47.8c6.5 0 12-2.1 16-6.5l-7.7-5.8c-2.1 1.4-4.8 2.3-8.3 2.3-6.1 0-11.4-4.1-13.3-9.2l-7.9 6.1C6.7 42.5 14.7 47.8 24 47.8Z" />
    </svg>
  );
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("created") === "1") {
      setSuccess("Account created. Please sign in.");
    }
    const oauthError = params.get("oauth");
    if (oauthError === "failed") {
      setError("Google sign in was cancelled or failed. Please try again.");
    }
    if (oauthError === "missing") {
      setError("Google did not return a valid sign-in token. Please try again.");
    }
    if (oauthError === "session") {
      setError("Google sign in succeeded, but the app could not save your session. Please try again.");
    }
    if (oauthError === "expired") {
      setError("Google sign in expired before it could be completed. Please try again.");
    }
    if (oauthError === "start_failed") {
      setError("Could not start Google sign in. Please refresh and try again.");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email || !password) {
      setError("Enter your email and password to sign in.");
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      window.location.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "We could not sign you in with those details.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="py-10">
      <header>
        <h1 className="font-heading text-auth-heading font-semibold text-text-primary">Welcome back</h1>
        <p className="mt-2 text-base text-text-muted">Sign in to your Retrace account.</p>
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
        {success ? (
          <div className="mb-5 rounded-[6px] border-l-[3px] border-success bg-success/[0.07] px-[14px] py-3 text-[14px] text-success">
            {success}
          </div>
        ) : null}
        <div className="space-y-5">
          <AuthInput
            autoComplete="email"
            disabled={isLoading}
            id="email"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@address.com"
            type="email"
            value={email}
          />
          <div>
            <AuthInput
              autoComplete="current-password"
              disabled={isLoading}
              id="password"
              label="Password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              toggleVisibility
              value={password}
            />
            <div className="mt-2 flex justify-end">
              <Link className="text-sm font-medium text-primary hover:underline" href="/auth/forgot-password">
                Forgot password?
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-7 space-y-3">
          <AuthButton isLoading={isLoading} type="submit">Sign in</AuthButton>
          <AuthDivider />
          <AuthButton disabled={isLoading} icon={<GoogleIcon />} onClick={loginWithGoogle} type="button" variant="ghost">
            Continue with Google
          </AuthButton>
        </div>
      </form>
      <p className="mt-5 text-center text-[14px] text-text-muted">
        Don&apos;t have an account?{" "}
        <Link className="font-semibold text-primary hover:underline" href="/auth/signup">
          Sign up
        </Link>
      </p>
    </div>
  );
}
