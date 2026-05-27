"use client";

import { Icon } from "../Icon";

export function NewSessionCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="flex min-h-session-card flex-col items-center justify-center rounded-card border-[1.5px] border-dashed border-border bg-transparent p-5 text-center text-text-muted transition-all hover:-translate-y-0.5 hover:border-border-hover hover:bg-surface/50 motion-reduce:hover:translate-y-0"
      onClick={onClick}
      type="button"
    >
      <Icon className="h-8 w-8 text-border-hover" name="post-add" />
      <span className="mt-3 text-sm">New Session</span>
    </button>
  );
}
