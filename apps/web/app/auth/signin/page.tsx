"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthButton } from "../../../components/auth/AuthButton";
import { AuthDivider } from "../../../components/auth/AuthDivider";
import { AuthInput } from "../../../components/auth/AuthInput";
import { login } from "../../../lib/auth";

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
          <AuthButton disabled={isLoading} icon={<span className="text-base font-semibold">G</span>} type="button" variant="ghost">
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
