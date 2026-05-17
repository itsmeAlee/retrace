"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const length = 6;

type OtpInputProps = {
  errorMessage?: string;
  hasError?: boolean;
  isVerifying?: boolean;
  onComplete?: (code: string) => void;
  onResend?: () => void;
  resendDisabled?: boolean;
  resendLabel?: string;
};

export function OtpInput({
  errorMessage,
  hasError = false,
  isVerifying = false,
  onComplete,
  onResend,
  resendDisabled = true,
  resendLabel = "Resend (60s)"
}: OtpInputProps) {
  const [values, setValues] = useState(Array(length).fill(""));
  const [error, setError] = useState(hasError);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const reduce = useReducedMotion();
  const complete = values.every(Boolean);

  function focus(index: number) {
    inputs.current[index]?.focus();
    inputs.current[index]?.select();
  }

  useEffect(() => {
    if (!hasError && !errorMessage) return;
    setError(true);
    setValues(Array(length).fill(""));
    window.requestAnimationFrame(() => focus(0));
  }, [errorMessage, hasError]);

  function updateValue(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);
    setError(false);
    if (digit && index < length - 1) focus(index + 1);
    if (digit && next.every(Boolean)) onComplete?.(next.join(""));
  }

  function handlePaste(rawValue: string) {
    const pasted = rawValue.replace(/\D/g, "").slice(0, length).split("");
    if (!pasted.length) return;
    const next = Array(length).fill("");
    pasted.forEach((digit, index) => {
      next[index] = digit;
    });
    setValues(next);
    setError(false);
    focus(Math.min(pasted.length, length) - 1);
    if (next.every(Boolean)) onComplete?.(next.join(""));
  }

  function handleBackspace(index: number) {
    const next = [...values];
    if (next[index]) {
      next[index] = "";
      setValues(next);
      return;
    }
    if (index > 0) {
      next[index - 1] = "";
      setValues(next);
      focus(index - 1);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <motion.div
        animate={error && !reduce ? { x: [0, -8, 8, -8, 8, 0] } : { opacity: 1 }}
        className="flex justify-center gap-[10px]"
        transition={{ duration: reduce ? 0.2 : 0.4 }}
      >
        {values.map((value, index) => (
          <input
            aria-label={`Digit ${index + 1}`}
            autoFocus={index === 0}
            className={`h-otp-h w-otp-w rounded-row border-[1.5px] bg-surface text-center font-body text-auth-heading font-bold text-text-primary outline-none transition-all focus:border-primary focus:shadow-focus ${
              error ? "border-error" : value ? "border-primary bg-primary/5" : "border-border"
            }`}
            inputMode="numeric"
            key={index}
            maxLength={1}
            disabled={isVerifying}
            onChange={(event) => updateValue(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                handleBackspace(index);
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              handlePaste(event.clipboardData.getData("text"));
            }}
            ref={(node) => {
              inputs.current[index] = node;
            }}
            type="text"
            value={value}
          />
        ))}
      </motion.div>
      {isVerifying || complete ? (
        <div className="mt-5 flex items-center gap-3 rounded-pill bg-neutral-soft px-4 py-2 text-sm italic text-text-muted">
          <span className="h-4 w-4 animate-spin rounded-pill border-2 border-border border-t-primary" />
          Verifying...
        </div>
      ) : null}
      {error ? <p className="mt-3 text-xs text-error">{errorMessage ?? "That code was not recognized. Try again."}</p> : null}
      <p className="mt-6 text-sm text-text-muted">
        Didn&apos;t receive it?{" "}
        <button
          className="font-medium text-primary disabled:text-text-muted/70"
          disabled={resendDisabled}
          onClick={onResend}
          type="button"
        >
          {resendLabel}
        </button>
      </p>
    </div>
  );
}
