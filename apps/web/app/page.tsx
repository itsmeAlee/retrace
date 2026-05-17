"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "../components/app/AppShell";
import { CreateSessionModal } from "../components/app/CreateSessionModal";
import { GettingStartedCards } from "../components/app/GettingStartedCards";
import { NewSessionCard } from "../components/app/NewSessionCard";
import { OnboardingProgress } from "../components/app/OnboardingProgress";
import { SessionCard } from "../components/app/SessionCard";
import { Icon } from "../components/Icon";
import { SkeletonCard } from "../components/ui/SkeletonCard";
import { itemLabel, timeAgo } from "../lib/format";
import { listSessions, type RetraceSession } from "../lib/sessions";

const fadeUp = (reduce: boolean) => ({
  hidden: { opacity: 0, y: reduce ? 0 : 16 },
  show: { opacity: 1, y: 0 }
});

export default function Page() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const variants = fadeUp(Boolean(reduce));
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
          <motion.header animate="show" initial="hidden" transition={{ duration: reduce ? 0.2 : 0.4, ease: "easeOut" }} variants={variants}>
            <h1 className="font-heading text-greeting font-semibold text-text-primary">Good morning, {firstName}.</h1>
            <p className="mt-2 text-md text-text-muted">Here is where you left off.</p>
            <motion.button
              className="mt-6 flex h-11 items-center gap-3 rounded-pill bg-primary px-6 text-base font-medium text-white shadow-card-hover transition-colors hover:bg-primary-hover"
              onClick={() => setModalOpen(true)}
              transition={{ duration: 0.2, type: "spring", stiffness: 320, damping: 24 }}
              type="button"
              whileHover={reduce ? undefined : { scale: 1.02 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
            >
              <Icon className="h-5 w-5" name="plus-circle" />
              + Start a new session
            </motion.button>
          </motion.header>

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
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  animate="show"
                  className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
                  exit={{ opacity: 0 }}
                  initial="hidden"
                  key="loading"
                  transition={{ staggerChildren: reduce ? 0 : 0.08 }}
                >
                  {Array.from({ length: 4 }).map((_, index) => (
                    <motion.div key={index} transition={{ duration: reduce ? 0.2 : 0.4, ease: "easeOut" }} variants={variants}>
                      <SkeletonCard />
                    </motion.div>
                  ))}
                </motion.div>
              ) : sessions.length === 0 ? (
                <motion.div className="mt-4" key="empty">
                  <GettingStartedCards onCreateSession={() => setModalOpen(true)} />
                  <OnboardingProgress hasSessions={false} />
                </motion.div>
              ) : (
                <motion.div
                  animate="show"
                  className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
                  exit={{ opacity: 0 }}
                  initial="hidden"
                  key="populated"
                  transition={{ staggerChildren: reduce ? 0 : 0.08 }}
                >
                  {sessions.map((session) => (
                    <motion.div key={session.$id} transition={{ duration: reduce ? 0.2 : 0.4, ease: "easeOut" }} variants={variants}>
                      <SessionCard
                        description={session.description || "No description yet."}
                        items={itemLabel(session.captureCount)}
                        onClick={() => router.push(`/sessions/${session.$id}`)}
                        status={session.status}
                        time={timeAgo(session.updatedAt)}
                        title={session.name}
                      />
                    </motion.div>
                  ))}
                  <motion.div transition={{ duration: reduce ? 0.2 : 0.4, ease: "easeOut" }} variants={variants}>
                    <NewSessionCard onClick={() => setModalOpen(true)} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
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
