"use client";

import { useRouter } from "next/navigation";

export default function SessionDetailError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-bg px-6 py-8 md:px-10">
      <div className="mx-auto max-w-[720px] rounded-card border border-border bg-surface p-8 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Session detail</p>
        <h1 className="mt-3 font-heading text-auth-heading font-bold text-text-primary">Could not load this session.</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          {error.message || "Try again, or return to your sessions list."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="h-auth-control rounded-pill bg-primary px-6 text-base font-medium text-white transition-colors hover:bg-primary-hover"
            onClick={reset}
            type="button"
          >
            Retry
          </button>
          <button
            className="h-auth-control rounded-pill border border-border bg-surface px-6 text-base font-medium text-text-muted transition-colors hover:border-primary hover:text-primary"
            onClick={() => router.push("/sessions")}
            type="button"
          >
            Back to sessions
          </button>
        </div>
      </div>
    </main>
  );
}
