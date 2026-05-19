"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../../components/app/AppShell";
import { DocumentWorkspace } from "../../../components/app/DocumentWorkspace";
import { NavigatorPanel } from "../../../components/app/NavigatorPanel";
import { Icon } from "../../../components/Icon";
import { Toast } from "../../../components/ui/Toast";
import {
  getSession,
  getSessionNote,
  getCheckpoints,
  getAllSessionSources,
  getCheckpointAttachments,
  type CaptureItem,
  type RetraceSession
} from "../../../lib/sessions";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;
  const checkpointRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [session, setSession] = useState<RetraceSession | null>(null);
  const [sessionNote, setSessionNote] = useState<CaptureItem | null>(null);
  const [checkpoints, setCheckpoints] = useState<CaptureItem[]>([]);
  const [sources, setSources] = useState<CaptureItem[]>([]);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, CaptureItem[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const loadAllData = async (silent = false) => {
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

      const generalAttachments = await getCheckpointAttachments("");
      const results = await Promise.all(attachmentsPromises);

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
  };

  useEffect(() => {
    loadAllData();
  }, [sessionId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const refreshData = () => {
    loadAllData(true);
  };

  const handleToggleCheckpoint = (checkpointId: string) => {
    setExpandedId(prev => (prev === checkpointId ? null : checkpointId));
  };

  const handleCheckpointClick = (checkpointId: string) => {
    setExpandedId(checkpointId);
    setTimeout(() => {
      const element = checkpointRefs.current[checkpointId];
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const handleCheckpointCreated = (checkpointId: string) => {
    loadAllData(true).then(() => {
      handleCheckpointClick(checkpointId);
    });
  };

  const handleAttachmentAdded = (item: CaptureItem) => {
    const key = item.checkpointId || "session";
    setAttachmentsMap((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), item]
    }));
    // Also refresh sources flat list
    getAllSessionSources(sessionId).then(setSources);
  };

  const handleAttachmentDeleted = async (id: string) => {
    // Delete via direct database document deletion
    try {
      const { appwriteClient } = await import("../../../lib/appwrite");
      const { Databases } = await import("appwrite");
      const response = await fetch("/api/auth/jwt", { method: "POST" });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.jwt) return;

      const client = appwriteClient.setJWT(data.jwt);
      const db = new Databases(client);
      await db.deleteDocument("retrace_auth", "capture_items", id);

      // Remove from state
      setAttachmentsMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          next[key] = next[key].filter((item) => item.$id !== id);
        });
        return next;
      });

      // Refresh sources
      getAllSessionSources(sessionId).then(setSources);
      setToast("Attachment deleted.");
    } catch {
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
            <div className="flex-1 px-6 py-8 md:px-12 max-w-3xl min-h-screen">
              {/* Back Button */}
              <button
                onClick={() => router.push("/sessions")}
                className="mb-6 flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-primary uppercase tracking-wider transition-colors"
                type="button"
              >
                <Icon className="h-4 w-4" name="arrow-left" />
                Back to Sessions
              </button>

              {session && (
                <DocumentWorkspace
                  session={session}
                  sessionNote={sessionNote}
                  checkpoints={checkpoints}
                  attachmentsMap={attachmentsMap}
                  expandedId={expandedId}
                  onToggleCheckpoint={handleToggleCheckpoint}
                  onRefresh={refreshData}
                  onAttachmentAdded={handleAttachmentAdded}
                  onAttachmentDeleted={handleAttachmentDeleted}
                  onCheckpointCreated={handleCheckpointCreated}
                  checkpointRefs={checkpointRefs}
                />
              )}
            </div>

            {/* Desktop Right Panel (Column 3) */}
            <div className="ml-auto hidden w-sidebar overflow-y-auto border-l border-border px-6 py-8 md:block md:sticky md:top-0 md:h-screen">
              <NavigatorPanel
                checkpoints={checkpoints}
                sources={sources}
                activeId={expandedId}
                onCheckpointClick={handleCheckpointClick}
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
                      activeId={expandedId}
                      onCheckpointClick={(id) => {
                        handleCheckpointClick(id);
                        setIsMobileDrawerOpen(false);
                      }}
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
