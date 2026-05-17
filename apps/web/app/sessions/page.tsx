"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/app/AppShell";
import { CreateSessionModal } from "../../components/app/CreateSessionModal";
import { EmptySessionsState } from "../../components/app/EmptySessionsState";
import { SessionCard } from "../../components/app/SessionCard";
import { Icon } from "../../components/Icon";
import { FilterTabs } from "../../components/ui/FilterTabs";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { Toast } from "../../components/ui/Toast";
import { itemLabel, timeAgo } from "../../lib/format";
import { listSessions, type RetraceSession, type SessionStatus } from "../../lib/sessions";

const filters = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" }
] as const;
type Filter = (typeof filters)[number];
type FilterValue = Filter["value"];

const fadeUp = (reduce: boolean) => ({
  hidden: { opacity: 0, y: reduce ? 0 : 16 },
  show: { opacity: 1, y: 0 }
});

export default function SessionsPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const variants = fadeUp(Boolean(reduce));
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sessions, setSessions] = useState<RetraceSession[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const pendingToast = sessionStorage.getItem("retrace-toast");
    if (pendingToast) {
      sessionStorage.removeItem("retrace-toast");
      setToast(pendingToast);
      window.setTimeout(() => setToast(""), 3000);
    }

    let active = true;
    listSessions(20)
      .then((result) => {
        if (!active) return;
        setSessions(result.sessions);
        setTotal(result.total);
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

  const visibleSessions = useMemo(() => {
    if (filter === "all") return sessions;
    return sessions.filter((session) => session.status === filter);
  }, [filter, sessions]);

  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const result = await listSessions(20, sessions.length);
      setSessions((current) => [...current, ...result.sessions]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more sessions.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AppShell onNewSession={() => setModalOpen(true)}>
      {() => (
        <>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-heading text-auth-heading font-bold text-text-primary">Sessions</h1>
            <button
              className="flex h-auth-control items-center justify-center gap-2 rounded-pill bg-primary px-6 text-base font-medium text-white transition-colors hover:bg-primary-hover"
              onClick={() => setModalOpen(true)}
              type="button"
            >
              <Icon className="h-4 w-4" name="add" />
              New Session
            </button>
          </div>

          <div className="mt-6">
            <FilterTabs onChange={setFilter} selectedTab={filter} tabs={filters} />
          </div>

          {error ? <p className="mt-5 text-sm text-error">{error}</p> : null}

          <motion.div
            animate="show"
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            transition={{ staggerChildren: reduce ? 0 : 0.08 }}
          >
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <motion.div key={index} transition={{ duration: reduce ? 0.2 : 0.4, ease: "easeOut" }} variants={variants}>
                    <SkeletonCard />
                  </motion.div>
                ))
              : visibleSessions.map((session) => (
                  <motion.div key={session.$id} transition={{ duration: reduce ? 0.2 : 0.4, ease: "easeOut" }} variants={variants}>
                    <SessionCard
                      description={session.description || "No description yet."}
                      items={itemLabel(session.captureCount)}
                      onClick={() => router.push(`/sessions/${session.$id}`)}
                      status={session.status as SessionStatus}
                      time={timeAgo(session.updatedAt)}
                      title={session.name}
                    />
                  </motion.div>
                ))}
          </motion.div>

          {!loading && sessions.length === 0 ? (
            <div className="mt-6">
              <EmptySessionsState onCreateSession={() => setModalOpen(true)} />
            </div>
          ) : !loading && visibleSessions.length === 0 ? (
            <div className="mt-6 rounded-card border-[1.5px] border-dashed border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-muted">No {filter} sessions. Start one →</p>
              <button className="mt-5 h-auth-control rounded-pill bg-primary px-6 text-base font-medium text-white" onClick={() => setModalOpen(true)} type="button">
                Create session
              </button>
            </div>
          ) : null}

          {total > sessions.length ? (
            <div className="mt-8 flex justify-center">
              <button
                className="text-sm font-medium text-primary transition-colors hover:underline disabled:opacity-75"
                disabled={loadingMore}
                onClick={loadMore}
                type="button"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          ) : null}

          <CreateSessionModal onClose={() => setModalOpen(false)} open={modalOpen} />
          <Toast message={toast} />
        </>
      )}
    </AppShell>
  );
}
