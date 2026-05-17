export function SkeletonCard() {
  return (
    <div className="min-h-session-card animate-pulse rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex justify-between gap-4">
        <div className="h-8 w-28 rounded bg-neutral-soft" />
        <div className="h-5 w-16 rounded-pill bg-neutral-soft" />
      </div>
      <div className="mt-8 h-24 rounded bg-neutral-soft" />
      <div className="mt-10 h-px bg-border" />
      <div className="mt-4 flex justify-between">
        <div className="h-4 w-20 rounded bg-neutral-soft" />
        <div className="h-4 w-24 rounded bg-neutral-soft" />
      </div>
    </div>
  );
}
