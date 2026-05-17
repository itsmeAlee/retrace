"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthButton } from "../../../components/auth/AuthButton";
import { AuthInput } from "../../../components/auth/AuthInput";
import { PasswordStrength } from "../../../components/auth/PasswordStrength";
import { signupInit } from "../../../lib/auth";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await signupInit(name, normalizedEmail, password);
      if (!result.success) {
        setError(result.message ?? "We could not start signup. Please try again.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      sessionStorage.setItem("retrace_signup_email", normalizedEmail);
      router.push("/auth/verify-otp?mode=verify");
    } catch {
      setError("We could not start signup. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="py-10">
      <header>
        <h1 className="font-heading text-auth-heading font-semibold text-text-primary">Create your account</h1>
        <p className="mt-2 text-base text-text-muted">Start capturing your work context.</p>
      </header>
      <form className="mt-10" onSubmit={handleSubmit}>
        {error ? (
          <div className="mb-5 rounded-[6px] border-l-[3px] border-error bg-error/[0.07] px-[14px] py-3 text-[14px] text-error">
            {error}
          </div>
        ) : null}
        <div className="space-y-5">
          <AuthInput disabled={isLoading} error={fieldErrors.name} id="name" label="Full name" onChange={(event) => setName(event.target.value)} placeholder="Julian Thorne" value={name} />
          <AuthInput disabled={isLoading} error={fieldErrors.email} id="email" label="Email" onChange={(event) => setEmail(event.target.value)} placeholder="julian@scholar.io" type="email" value={email} />
          <div>
            <AuthInput
              error={fieldErrors.password}
              disabled={isLoading}
              id="password"
              label="Password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              toggleVisibility
              value={password}
            />
            <PasswordStrength password={password} />
          </div>
          <AuthInput
            error={fieldErrors.confirmPassword}
            disabled={isLoading}
            id="confirm-password"
            label="Confirm password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Password"
            toggleVisibility
            value={confirmPassword}
          />
        </div>
        <div className="mt-7">
          <AuthButton isLoading={isLoading} type="submit">Create account</AuthButton>
        </div>
      </form>
      <p className="mt-5 text-center text-[14px] text-text-muted">
        Already have an account?{" "}
        <Link className="font-semibold text-primary hover:underline" href="/auth/signin">
          Sign in
        </Link>
      </p>
    </div>
  );
}
