"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "../components/app/AppShell";
import { NewSessionCard } from "../components/app/NewSessionCard";
import { OnboardingProgress } from "../components/app/OnboardingProgress";
import { SessionCard } from "../components/app/SessionCard";
import { Icon } from "../components/Icon";
import { SkeletonCard } from "../components/ui/SkeletonCard";
import { itemLabel, timeAgo } from "../lib/format";
import { listSessions, type RetraceSession } from "../lib/sessions";

const sessionGridClassName = "mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4";
const CreateSessionModal = dynamic(
  () => import("../components/app/CreateSessionModal").then((mod) => mod.CreateSessionModal),
  { ssr: false }
);
const GettingStartedCards = dynamic(
  () => import("../components/app/GettingStartedCards").then((mod) => mod.GettingStartedCards),
  {
    loading: () => (
      <div className={sessionGridClassName}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    )
  }
);

export default function Page() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [sessions, setSessions] = useState<RetraceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listSessions(4)
      .then((result) => {
        if (!active) return;
        setSessions(result.sessions);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load sessions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell onNewSession={() => setModalOpen(true)}>
      {({ firstName }) => (
        <>
          <header>
            <h1 className="font-heading text-greeting font-semibold text-text-primary">Good morning, {firstName}.</h1>
            <p className="mt-2 text-md text-text-muted">Here is where you left off.</p>
            <button
              className="mt-6 flex h-11 items-center gap-3 rounded-pill bg-primary px-6 text-base font-medium text-white shadow-card-hover transition-all hover:scale-[1.02] hover:bg-primary-hover active:scale-[0.98] motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
              onClick={() => setModalOpen(true)}
              type="button"
            >
              <Icon className="h-5 w-5" name="plus-circle" />
              + Start a new session
            </button>
          </header>

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">{!loading && sessions.length === 0 ? "Get Started" : "Recent Sessions"}</h2>
              {!loading && sessions.length > 0 ? (
                <Link className="text-sm font-medium text-primary hover:underline" href="/sessions">
                  View all →
                </Link>
              ) : null}
            </div>
            {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
            {loading ? (
              <div className={sessionGridClassName}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="mt-4">
                <GettingStartedCards onCreateSession={() => setModalOpen(true)} />
                <OnboardingProgress hasSessions={false} />
              </div>
            ) : (
              <div className={sessionGridClassName}>
                {sessions.map((session) => (
                  <SessionCard
                    key={session.$id}
                    description={session.description || "No description yet."}
                    items={itemLabel(session.captureCount)}
                    onClick={() => router.push(`/sessions/${session.$id}`)}
                    status={session.status}
                    time={timeAgo(session.updatedAt)}
                    title={session.name}
                  />
                ))}
                <NewSessionCard onClick={() => setModalOpen(true)} />
              </div>
            )}
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Quick Capture Inbox</h2>
              <span className="rounded-pill bg-neutral-soft px-3 py-1 text-xs font-semibold text-text-muted">0 unassigned</span>
            </div>
            <div className="mt-4 rounded-card border border-border bg-surface px-5 py-10 text-center text-sm text-text-muted">
              Captured inbox items will appear here once the extension starts sending them.
            </div>
          </section>

          <CreateSessionModal onClose={() => setModalOpen(false)} open={modalOpen} />
        </>
      )}
    </AppShell>
  );
}
