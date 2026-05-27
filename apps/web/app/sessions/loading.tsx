import { SkeletonCard } from "../../components/ui/SkeletonCard";

export default function LoadingSessions() {
  return (
    <main className="min-h-screen bg-bg px-5 py-10 md:px-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="h-8 w-40 animate-pulse rounded bg-neutral-soft" />
        <div className="mt-6 h-12 w-full max-w-md animate-pulse rounded-pill bg-neutral-soft" />
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
