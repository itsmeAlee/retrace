export default function LoadingSessionDetail() {
  return (
    <main className="min-h-screen bg-bg px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="h-5 w-36 animate-pulse rounded-full bg-neutral-soft" />
        <div className="mt-8 h-9 w-2/3 animate-pulse rounded bg-neutral-soft" />
        <div className="mt-4 h-5 w-1/2 animate-pulse rounded bg-neutral-soft" />
        <div className="mt-8 rounded-card border border-border bg-surface px-6 py-5 shadow-card">
          <div className="h-4 w-full animate-pulse rounded bg-neutral-soft" />
          <div className="mt-3 h-4 w-11/12 animate-pulse rounded bg-neutral-soft" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-neutral-soft" />
          <div className="mt-12 h-10 w-full animate-pulse rounded bg-neutral-soft" />
        </div>
      </div>
    </main>
  );
}
