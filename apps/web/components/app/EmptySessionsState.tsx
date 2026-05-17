"use client";

import { Icon } from "../Icon";

type EmptySessionsStateProps = {
  onCreateSession: () => void;
};

export function EmptySessionsState({ onCreateSession }: EmptySessionsStateProps) {
  return (
    <div className="rounded-card border-[1.5px] border-dashed border-border bg-surface px-6 py-16 text-center">
      <Icon className="mx-auto h-10 w-10 text-border-hover" name="sessions" />
      <h2 className="mt-5 font-heading text-xl font-semibold text-text-primary">No sessions yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
        Create a session to start organizing your research, tracking your focus, and building your archive.
      </p>
      <button
        className="mt-6 inline-flex h-auth-control items-center justify-center gap-2 rounded-pill bg-primary px-6 text-base font-medium text-white transition-colors hover:bg-primary-hover"
        onClick={onCreateSession}
        type="button"
      >
        <Icon className="h-4 w-4" name="add" />
        Create your first session
      </button>
    </div>
  );
}
