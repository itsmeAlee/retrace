"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Icon } from "../Icon";

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  label: string;
  toggleVisibility?: boolean;
};

export function AuthInput({ error, id, label, toggleVisibility = false, type = "text", className = "", ...props }: AuthInputProps) {
  const [visible, setVisible] = useState(false);
  const inputType = toggleVisibility ? (visible ? "text" : "password") : type;

  return (
    <div className="flex flex-col">
      <label className="mb-[6px] text-sm font-medium leading-[1.2] text-text-muted" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          className={`h-auth-control w-full rounded-form border-[1.5px] bg-surface px-[14px] text-base text-text-primary outline-none transition-shadow placeholder:text-text-muted/55 focus:border-primary focus:shadow-focus ${
            error ? "border-error shadow-error-focus" : "border-border"
          } ${toggleVisibility ? "pr-12" : ""} ${className}`}
          id={id}
          type={inputType}
          {...props}
        />
        {toggleVisibility ? (
          <button
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill text-text-muted transition-colors hover:text-primary"
            onClick={() => setVisible((value) => !value)}
            type="button"
          >
            <Icon className="h-5 w-5" name={visible ? "eye-off" : "eye"} />
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-[6px] text-xs text-error">{error}</p> : null}
    </div>
  );
}
