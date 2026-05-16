import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children = "Button", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      style={{
        border: "1px solid #E4E2DC",
        borderRadius: 8,
        background: "#1A3C34",
        color: "#FFFFFF",
        cursor: "pointer",
        font: "inherit",
        padding: "0.625rem 0.875rem",
        ...props.style
      }}
    >
      {children}
    </button>
  );
}
