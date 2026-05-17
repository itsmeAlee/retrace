"use client";

import { motion, useReducedMotion } from "framer-motion";

export function getPasswordStrength(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const labels = ["", "Weak", "Fair", "Strong"];
const fills = ["bg-border", "bg-error", "bg-accent", "bg-success"];

export function PasswordStrength({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const reduce = useReducedMotion();

  return (
    <div className="w-full">
      <div className="flex h-1 w-full overflow-hidden rounded-pill bg-border">
        {[1, 2, 3].map((segment) => (
          <div className="flex-1 px-[1px]" key={segment}>
            <motion.div
              animate={{ width: strength >= segment ? "100%" : "0%" }}
              className={`h-full rounded-pill ${strength >= segment ? fills[strength] : "bg-transparent"}`}
              transition={{ duration: reduce ? 0.2 : 0.3, ease: "easeOut" }}
            />
          </div>
        ))}
      </div>
      {strength > 0 ? <p className="mt-[6px] text-right text-xs text-text-muted">{labels[strength]}</p> : null}
    </div>
  );
}
