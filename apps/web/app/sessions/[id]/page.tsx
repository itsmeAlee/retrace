"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../../components/app/AppShell";
import { DocumentWorkspace } from "../../../components/app/DocumentWorkspace";
import { NavigatorPanel } from "../../../components/app/NavigatorPanel";
import { Icon } from "../../../components/Icon";
import { Toast } from "../../../components/ui/Toast";
import { uiDurations } from "../../../lib/app-constants";
import { deleteFile } from "../../../lib/storage";
import {
  deleteCapture,
  getSession,
  getSessionNote,
  getCheckpoints,
  getAllSessionSources,
  getCheckpointAttachments,
  getSessionAttachments,
  type CaptureItem,
  type RetraceSession
} from "../../../lib/sessions";

const CheckpointContextView = dynamic(
  () => import("../../../components/app/CheckpointContextView").then((mod) => mod.CheckpointContextView),
  {
    loading: () => (
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="h-5 w-48 animate-pulse rounded-full bg-neutral-soft" />
        <div className="mt-5 space-y-3">
          <div className="h-3.5 w-full animate-pulse rounded-full bg-neutral-soft" />
          <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-neutral-soft" />
          <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-neutral-soft" />
        </div>
      </div>
    )
  }
);

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const [modalOpen, setModalOpen] = useState(false);
  const [session, setSession] = useState<RetraceSession | null>(null);
  const [sessionNote, setSessionNote] = useState<CaptureItem | null>(null);
  const [checkpoints, setCheckpoints] = useState<CaptureItem[]>([]);
  const [sources, setSources] = useState<CaptureItem[]>([]);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, CaptureItem[]>>({});
  
  const [activeCheckpointId, setActiveCheckpointId] = useState<string | null>(null);
  const [activeCheckpointName, setActiveCheckpointName] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"doc" | "checkpoint">("doc");

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [loadedSession, loadedNote, loadedCheckpoints, loadedSources] = await Promise.all([
        getSession(sessionId),
        getSessionNote(sessionId),
        getCheckpoints(sessionId),
        getAllSessionSources(sessionId)
      ]);

      setSession(loadedSession);
      setSessionNote(loadedNote);
      setCheckpoints(loadedCheckpoints);
      setSources(loadedSources);

      // Fetch attachments for all checkpoints & session note in parallel
      const attachmentsPromises = loadedCheckpoints.map(async (cp) => {
        const atts = await getCheckpointAttachments(cp.$id);
        return { id: cp.$id, atts };
      });

      const [generalAttachments, results] = await Promise.all([
        getSessionAttachments(sessionId),
        Promise.all(attachmentsPromises)
      ]);

      const map: Record<string, CaptureItem[]> = {
        session: generalAttachments
      };
      results.forEach(({ id, atts }) => {
        map[id] = atts;
      });

      setAttachmentsMap(map);
    } catch (err: any) {
      const message = err?.message || "Could not load session details.";
      setToast(message);
      // Fallback
      if (!silent) {
        sessionStorage.setItem("retrace-toast", message);
        router.replace("/sessions");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [router, sessionId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), uiDurations.toastMs);
    return () => clearTimeout(timeout);
  }, [toast]);

  const refreshData = () => {
    loadAllData(true);
  };

  const handleCheckpointClick = (checkpointId: string, checkpointName?: string) => {
    setActiveCheckpointId(checkpointId);
    setActiveCheckpointName(checkpointName || null);
    setActiveView("checkpoint");
  };

  const returnToDocMode = () => {
    setActiveView("doc");
    setActiveCheckpointId(null);
    setActiveCheckpointName(null);
  };

  const continueWorking = () => {
    setActiveView("doc");
    window.setTimeout(() => {
      document.getElementById("session-current-notes")?.scrollIntoView({ behavior: "smooth", block: "end" });
      const textarea = document.querySelector<HTMLTextAreaElement>("#session-current-notes textarea:not([readonly])");
      textarea?.focus();
    }, 50);
  };

  const handleCheckpointCreated = (checkpoint: CaptureItem, movedAttachmentIds: string[]) => {
    const movedIds = new Set(movedAttachmentIds);
    setActiveCheckpointId(checkpoint.$id);
    setCheckpoints((prev) => [checkpoint, ...prev.filter((item) => item.$id !== checkpoint.$id)]);
    setSessionNote((prev) => prev ? { ...prev, content: "", $updatedAt: new Date().toISOString() } : prev);
    setAttachmentsMap((prev) => {
      const moved = (prev.session || []).filter((attachment) => movedIds.has(attachment.$id));
      return {
        ...prev,
        session: (prev.session || []).filter((attachment) => !movedIds.has(attachment.$id)),
        [checkpoint.$id]: [
          ...(prev[checkpoint.$id] || []),
          ...moved.map((attachment) => ({ ...attachment, checkpointId: checkpoint.$id }))
        ]
      };
    });
    setSources((prev) => prev.filter((source) => !movedIds.has(source.$id)));
    setToast("Checkpoint saved.");
    void loadAllData(true);
  };

  const handleAttachmentAdded = (item: CaptureItem) => {
    const key = item.checkpointId?.trim() || "session";
    setAttachmentsMap((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), item]
    }));
    // Also refresh sources flat list
    getAllSessionSources(sessionId).then(setSources);
  };

  const handleAttachmentDeleted = (item: CaptureItem) => {
    setAttachmentsMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = next[key].filter((attachment) => attachment.$id !== item.$id);
      });
      return next;
    });
    setSources((prev) => prev.filter((source) => source.$id !== item.$id));

    void deleteAttachmentInBackground(item);
  };

  const deleteAttachmentInBackground = async (item: CaptureItem) => {
    try {
      await deleteCapture(item.$id);
      if (item.fileId) {
        await deleteFile(item.fileId).catch(() => {});
      }

      getAllSessionSources(sessionId).then(setSources);
      setToast("Attachment deleted.");
    } catch {
      const key = item.checkpointId?.trim() || "session";
      setAttachmentsMap((prev) => ({
        ...prev,
        [key]: prev[key]?.some((attachment) => attachment.$id === item.$id)
          ? prev[key]
          : [...(prev[key] || []), item]
      }));
      setSources((prev) => (prev.some((source) => source.$id === item.$id) ? prev : [item, ...prev]));
      setToast("Could not delete attachment.");
    }
  };

  if (loading) {
    return (
      <AppShell contentClassName="min-h-screen px-5 py-10 md:px-12" onNewSession={() => setModalOpen(true)}>
        {() => (
          <div className="flex flex-col gap-6 max-w-3xl">
            <div className="h-8 w-40 animate-pulse rounded bg-neutral-soft" />
            <div className="h-16 w-full animate-pulse rounded bg-neutral-soft" />
            <div className="h-40 w-full animate-pulse rounded bg-neutral-soft" />
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell contentClassName="min-h-screen px-0 py-0" onNewSession={() => setModalOpen(true)}>
      {() => (
        <div className="flex flex-col min-h-screen bg-bg">
          <div className="flex-1 flex flex-col md:flex-row relative">
            
            {/* Main workspace (Column 2) */}
            <div className="min-h-screen flex-1 px-6 py-8 md:px-10">
              <div className="mx-auto w-full max-w-4xl">
                {/* Back & Export Row */}
                <div className="flex items-center justify-between mb-6">
                  {activeView === "checkpoint" ? (
                    <div />
                  ) : (
                    <button
                      onClick={() => router.push("/sessions")}
                      className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-primary uppercase tracking-wider transition-colors"
                      type="button"
                    >
                      <Icon className="h-4 w-4" name="arrow-left" />
                      Back to Sessions
                    </button>
                  )}

                  <button
                    onClick={() => setToast("Export coming soon.")}
                    className="h-[36px] px-4 rounded-form border border-border text-xs font-semibold text-text-muted hover:text-primary hover:border-primary transition-all uppercase tracking-wider"
                    type="button"
                  >
                    Export
                  </button>
                </div>

                {activeView === "checkpoint" && activeCheckpointId ? (
                  <CheckpointContextView
                    checkpointId={activeCheckpointId}
                    checkpointName={activeCheckpointName || checkpoints.find((item) => item.$id === activeCheckpointId)?.checkpointName || ""}
                    sessionId={sessionId}
                    onBack={returnToDocMode}
                    onContinue={continueWorking}
                  />
                ) : (
                  session && (
                    <DocumentWorkspace
                      session={session}
                      sessionNote={sessionNote}
                      attachmentsMap={attachmentsMap}
                      onRefresh={refreshData}
                      onAttachmentAdded={handleAttachmentAdded}
                      onAttachmentDeleted={handleAttachmentDeleted}
                      onCheckpointCreated={handleCheckpointCreated}
                    />
                  )
                )}
              </div>
            </div>

            {/* Desktop Right Panel (Column 3) */}
            <div className="ml-auto hidden w-sidebar overflow-y-auto border-l border-border px-6 py-8 md:block md:sticky md:top-0 md:h-screen">
              <NavigatorPanel
                checkpoints={checkpoints}
                sources={sources}
                activeCheckpointId={activeCheckpointId}
                activeView={activeView}
                onCheckpointSelect={handleCheckpointClick}
                onBack={returnToDocMode}
              />
            </div>

          </div>

          {/* Mobile FAB and Drawer Navigation */}
          <div className="md:hidden">
            {/* FAB button */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all z-40"
              type="button"
            >
              <Icon name="sessions" className="h-5 w-5" />
            </button>

            {/* Sliding Bottom Sheet Drawer */}
            <AnimatePresence>
              {isMobileDrawerOpen && (
                <>
                  {/* Backdrop overlay */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="fixed inset-0 bg-black z-40"
                  />

                  {/* Bottom sheet */}
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 h-[60vh] bg-surface rounded-t-2xl z-50 p-6 flex flex-col shadow-2xl overflow-y-auto"
                  >
                    <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Navigation</h3>
                      <button
                        onClick={() => setIsMobileDrawerOpen(false)}
                        className="p-1 text-text-muted hover:text-text-primary rounded-full hover:bg-neutral-soft"
                      >
                        <Icon name="x" className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <NavigatorPanel
                      checkpoints={checkpoints}
                      sources={sources}
                      activeCheckpointId={activeCheckpointId}
                      activeView={activeView}
                      onCheckpointSelect={(id, name) => {
                        handleCheckpointClick(id, name);
                        setIsMobileDrawerOpen(false);
                      }}
                      onBack={returnToDocMode}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Toast popup */}
          {toast && <Toast message={toast} />}
        </div>
      )}
    </AppShell>
  );
}
