"use client";

import { Icon } from "../Icon";

type OnboardingProgressProps = {
  hasSessions: boolean;
};

const steps = ["Create a session", "Capture something", "Resume with AI"];

export function OnboardingProgress({ hasSessions }: OnboardingProgressProps) {
  const completed = [hasSessions, false, false];

  if (completed.every(Boolean)) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-wrap gap-6">
      {steps.map((step, index) => (
        <div className="flex items-center gap-2" key={step}>
          <span
            className={`flex h-indicator w-indicator items-center justify-center rounded-pill border-[1.5px] ${
              completed[index] ? "border-primary bg-primary text-white" : "border-border bg-transparent"
            }`}
          >
            {completed[index] ? <Icon className="h-2 w-2" name="check" /> : null}
          </span>
          <span className="text-sm text-text-muted">{step}</span>
        </div>
      ))}
    </div>
  );
}
