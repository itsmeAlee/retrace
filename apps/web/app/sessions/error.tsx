"use client";

export default function SessionsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-bg px-5 py-10 md:px-12">
      <div className="mx-auto max-w-[720px] rounded-card border border-border bg-surface p-8 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Sessions</p>
        <h1 className="mt-3 font-heading text-auth-heading font-bold text-text-primary">Could not load sessions.</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          {error.message || "Refresh the list and try again."}
        </p>
        <button
          className="mt-6 h-auth-control rounded-pill bg-primary px-6 text-base font-medium text-white transition-colors hover:bg-primary-hover"
          onClick={reset}
          type="button"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
