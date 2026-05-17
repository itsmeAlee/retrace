"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../../../components/app/AppShell";
import { CaptureCard, iconForType } from "../../../components/app/CaptureCard";
import { CreateSessionModal } from "../../../components/app/CreateSessionModal";
import { EmptyCapturesState } from "../../../components/app/EmptyCapturesState";
import { Icon } from "../../../components/Icon";
import { FilterTabs } from "../../../components/ui/FilterTabs";
import { Toast } from "../../../components/ui/Toast";
import { itemLabel, shortDate, timeAgo } from "../../../lib/format";
import {
  addCapture,
  getSession,
  listCaptures,
  updateSession,
  type CaptureItem,
  type CaptureType,
  type RetraceSession,
  type SessionStatus
} from "../../../lib/sessions";

const captureFilters = [
  { label: "All", value: "all" },
  { label: "Text", value: "text" },
  { label: "Links", value: "url" },
  { label: "Videos", value: "video" },
  { label: "Notes", value: "note" },
  { label: "Audio", value: "audio" }
] as const;
type CaptureFilter = (typeof captureFilters)[number]["value"];

const captureTypes = ["text", "url", "note", "video"] as const;
const statuses: SessionStatus[] = ["active", "paused", "completed", "archived"];

const statusStyles: Record<SessionStatus, string> = {
  active: "bg-primary/10 text-primary",
  paused: "bg-accent/15 text-draft-text",
  completed: "bg-success/10 text-success",
  archived: "bg-neutral-soft text-text-muted"
};

const fadeUp = (reduce: boolean) => ({
  hidden: { opacity: 0, y: reduce ? 0 : 16 },
  show: { opacity: 1, y: 0 }
});

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;
  const reduce = useReducedMotion();
  const variants = fadeUp(Boolean(reduce));
  const manualPanelRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [session, setSession] = useState<RetraceSession | null>(null);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [filter, setFilter] = useState<CaptureFilter>("all");
  const [loading, setLoading] = useState(true);
  const [captureLoading, setCaptureLoading] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getSession(sessionId), listCaptures(sessionId)])
      .then(([loadedSession, captureResult]) => {
        if (!active) return;
        setSession(loadedSession);
        setCaptures(captureResult.captures);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load this session.";
        sessionStorage.setItem("retrace-toast", message);
        router.replace("/sessions");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setCaptureLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, sessionId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const visibleCaptures = useMemo(() => {
    if (filter === "all") return captures;
    return captures.filter((capture) => capture.type === filter);
  }, [captures, filter]);

  async function saveSession(fields: Partial<Pick<RetraceSession, "name" | "description" | "status">>) {
    if (!session) return;
    try {
      const updated = await updateSession(session.$id, fields);
      setSession(updated);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not update session.");
    }
  }

  function scrollToManualPanel() {
    manualPanelRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  if (loading) {
    return (
      <AppShell contentClassName="min-h-screen px-5 py-10 md:px-12" onNewSession={() => setModalOpen(true)}>
        {() => <div className="h-40 animate-pulse rounded-card bg-neutral-soft" />}
      </AppShell>
    );
  }

  return (
    <AppShell contentClassName="min-h-screen px-0 py-0" onNewSession={() => setModalOpen(true)}>
      {() => (
        <>
          {session ? (
            <div className="flex min-h-screen flex-col lg:flex-row">
              <section className="min-w-0 flex-1 px-5 py-10 md:px-8">
                <button className="mb-6 flex items-center gap-2 text-sm font-medium text-text-muted hover:text-primary" onClick={() => router.push("/sessions")} type="button">
                  <Icon className="h-4 w-4" name="arrow-left" />
                  Back to Sessions
                </button>
                <SessionHeader session={session} onSave={saveSession} />

                <div className="mt-6">
                  <FilterTabs onChange={setFilter} selectedTab={filter} tabs={captureFilters} />
                </div>

                <motion.div animate="show" className="mt-4" initial="hidden" transition={{ staggerChildren: reduce ? 0 : 0.05 }}>
                  {captureLoading ? (
                    Array.from({ length: 3 }).map((_, index) => <CaptureSkeleton key={index} />)
                  ) : visibleCaptures.length > 0 ? (
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleCaptures.map((capture) => (
                        <motion.div
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          initial={{ height: reduce ? "auto" : 0, opacity: 0 }}
                          key={capture.$id}
                          layout
                          transition={{ duration: reduce ? 0.2 : 0.3, ease: "easeOut" }}
                          variants={variants}
                        >
                          <CaptureCard capture={capture} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  ) : (
                    <EmptyCapturesState onAddManually={scrollToManualPanel} />
                  )}
                </motion.div>
              </section>

              <motion.aside
                animate={{ opacity: 1 }}
                className="w-full border-t border-border bg-surface p-6 lg:sticky lg:top-0 lg:max-h-screen lg:w-detail-panel lg:overflow-y-auto lg:border-l lg:border-t-0"
                initial={{ opacity: 0 }}
                ref={manualPanelRef}
                transition={{ delay: reduce ? 0 : 0.2, duration: reduce ? 0.15 : 0.3 }}
              >
                <ManualCaptureForm
                  onCreated={(tempCapture, createRequest) => {
                    setCaptures((current) => [tempCapture, ...current]);
                    createRequest
                      .then((created) => {
                        setCaptures((current) => current.map((capture) => (capture.$id === tempCapture.$id ? created : capture)));
                        setSession((current) =>
                          current ? { ...current, captureCount: current.captureCount + 1, updatedAt: created.createdAt } : current
                        );
                      })
                      .catch((err) => {
                        setCaptures((current) => current.filter((capture) => capture.$id !== tempCapture.$id));
                        setToast(err instanceof Error ? err.message : "Could not add capture.");
                      });
                  }}
                  sessionId={session.$id}
                />
                <div className="my-6 h-px bg-border" />
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Session info</h3>
                <div className="mt-4 space-y-3 text-sm text-text-muted">
                  <p>Started {shortDate(session.createdAt)}</p>
                  <p>Last updated {timeAgo(session.updatedAt)}</p>
                  <p>{itemLabel(session.captureCount)} captured</p>
                </div>
              </motion.aside>
            </div>
          ) : null}
          <Toast message={toast} />
          <CreateSessionModal onClose={() => setModalOpen(false)} open={modalOpen} />
        </>
      )}
    </AppShell>
  );
}

function SessionHeader({
  session,
  onSave
}: {
  session: RetraceSession;
  onSave: (fields: Partial<Pick<RetraceSession, "name" | "description" | "status">>) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [name, setName] = useState(session.name);
  const [description, setDescription] = useState(session.description ?? "");

  useEffect(() => {
    setName(session.name);
    setDescription(session.description ?? "");
  }, [session]);

  function keySave(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, callback: () => void) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      callback();
    }
  }

  return (
    <header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="group min-w-0 flex-1">
          {editingName ? (
            <input
              autoFocus
              className="w-full rounded-form border-[1.5px] border-border bg-surface px-3 py-2 font-heading text-auth-heading font-bold outline-none focus:border-primary focus:shadow-focus"
              onBlur={() => {
                setEditingName(false);
                if (name.trim() && name !== session.name) onSave({ name: name.trim() });
              }}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => keySave(event, () => event.currentTarget.blur())}
              value={name}
            />
          ) : (
            <button className="flex items-center gap-2 text-left font-heading text-auth-heading font-bold text-text-primary" onClick={() => setEditingName(true)} type="button">
              {session.name}
              <Icon className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" name="pencil" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            className={`rounded-pill px-3 py-1 text-xs font-semibold uppercase ${statusStyles[session.status]}`}
            onClick={() => setStatusOpen((open) => !open)}
            type="button"
          >
            {session.status}
          </button>
          <AnimatePresence>
            {statusOpen ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-8 z-20 min-w-36 rounded-form border border-border bg-surface p-1 shadow-card-hover"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: -4 }}
              >
                {statuses.map((status) => (
                  <button
                    className="block w-full rounded-form px-3 py-2 text-left text-sm capitalize text-text-muted hover:bg-bg hover:text-primary"
                    key={status}
                    onClick={() => {
                      setStatusOpen(false);
                      if (status !== session.status) onSave({ status });
                    }}
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {editingDescription ? (
        <textarea
          autoFocus
          className="mt-3 min-h-24 w-full resize-none rounded-form border-[1.5px] border-border bg-surface px-3 py-2 text-base text-text-muted outline-none focus:border-primary focus:shadow-focus"
          onBlur={() => {
            setEditingDescription(false);
            if (description !== (session.description ?? "")) onSave({ description });
          }}
          onChange={(event) => setDescription(event.target.value)}
          onKeyDown={(event) => keySave(event, () => event.currentTarget.blur())}
          value={description}
        />
      ) : (
        <button className="mt-3 block text-left text-base text-text-muted" onClick={() => setEditingDescription(true)} type="button">
          {session.description || "Add a description..."}
        </button>
      )}
      <p className="mt-2 text-sm text-text-muted">Started {shortDate(session.createdAt)} · {itemLabel(session.captureCount)}</p>
    </header>
  );
}

function ManualCaptureForm({
  onCreated,
  sessionId
}: {
  onCreated: (tempCapture: CaptureItem, createRequest: Promise<CaptureItem>) => void;
  sessionId: string;
}) {
  const reduce = useReducedMotion();
  const [type, setType] = useState<(typeof captureTypes)[number]>("text");
  const [content, setContent] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError("");

    const createdAt = new Date().toISOString();
    const tempCapture: CaptureItem = {
      $id: `temp-${createdAt}`,
      sessionId,
      userId: "",
      type,
      content: content.trim(),
      sourceUrl: type === "url" || type === "video" ? content.trim() : undefined,
      sourceTitle: sourceTitle.trim() || undefined,
      note: note.trim() || undefined,
      createdAt
    };

    const createRequest = addCapture(
      sessionId,
      type,
      content.trim(),
      type === "url" || type === "video" ? content.trim() : undefined,
      sourceTitle.trim() || undefined,
      note.trim() || undefined
    ).finally(() => setLoading(false));

    onCreated(tempCapture, createRequest);
    setContent("");
    setSourceTitle("");
    setNote("");
    setNoteOpen(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-base font-semibold text-text-primary">Add context</h3>
      <p className="mt-1 text-sm text-text-muted">Add a capture manually while the extension is quiet.</p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {captureTypes.map((item) => (
          <button
            aria-label={item}
            className={`flex h-icon-lg items-center justify-center rounded-form transition-colors ${type === item ? "bg-primary text-white" : "bg-bg text-text-muted"}`}
            key={item}
            onClick={() => setType(item)}
            type="button"
          >
            <Icon className="h-5 w-5" name={iconForType(item)} />
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {type === "text" || type === "note" ? (
          <textarea
            className="min-h-32 w-full resize-none rounded-form border-[1.5px] border-border bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:shadow-focus"
            disabled={loading}
            onChange={(event) => setContent(event.target.value)}
            placeholder={type === "note" ? "Write a note..." : "Paste or type text..."}
            required
            value={content}
          />
        ) : (
          <>
            <input
              className="h-auth-control w-full rounded-form border-[1.5px] border-border bg-surface px-4 text-base outline-none focus:border-primary focus:shadow-focus"
              disabled={loading}
              onChange={(event) => setContent(event.target.value)}
              placeholder={type === "video" ? "Paste a YouTube URL..." : "Paste a URL..."}
              required
              value={content}
            />
            {type === "url" ? (
              <input
                className="h-auth-control w-full rounded-form border-[1.5px] border-border bg-surface px-4 text-base outline-none focus:border-primary focus:shadow-focus"
                disabled={loading}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="Page title (optional)"
                value={sourceTitle}
              />
            ) : null}
          </>
        )}
      </div>

      <button className="mt-3 text-sm font-medium text-primary" onClick={() => setNoteOpen((open) => !open)} type="button">
        + Add a note
      </button>
      <AnimatePresence initial={false}>
        {noteOpen ? (
          <motion.textarea
            animate={{ height: "auto", opacity: 1 }}
            className="mt-3 min-h-16 w-full resize-none rounded-form border-[1.5px] border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary focus:shadow-focus"
            disabled={loading}
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: reduce ? "auto" : 0, opacity: 0 }}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a note (optional)"
            value={note}
          />
        ) : null}
      </AnimatePresence>

      {error ? <p className="mt-3 text-xs text-error">{error}</p> : null}
      <button className="mt-4 flex h-11 w-full items-center justify-center rounded-pill bg-primary text-base font-medium text-white disabled:opacity-75" disabled={loading} type="submit">
        {loading ? <span className="h-5 w-5 animate-spin rounded-pill border-2 border-white/30 border-t-white" /> : "Add to session"}
      </button>
    </form>
  );
}

function CaptureSkeleton() {
  return <div className="mb-2 h-24 animate-pulse rounded-row border border-border bg-surface p-4" />;
}
