"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { uiDurations } from "../../lib/app-constants";
import { logError } from "../../lib/debug";
import { NoteArea } from "./NoteArea";
import {
  createCheckpoint,
  updateSession,
  upsertSessionNote,
  type RetraceSession,
  type CaptureItem
} from "../../lib/sessions";

interface DocumentWorkspaceProps {
  session: RetraceSession;
  sessionNote: CaptureItem | null;
  attachmentsMap: Record<string, CaptureItem[]>;
  onRefresh: () => void;
  onAttachmentAdded: (item: CaptureItem) => void;
  onAttachmentDeleted: (item: CaptureItem) => void;
  onCheckpointCreated: (checkpoint: CaptureItem, movedAttachmentIds: string[]) => void;
}

export function DocumentWorkspace({
  session,
  sessionNote,
  attachmentsMap,
  onRefresh,
  onAttachmentAdded,
  onAttachmentDeleted,
  onCheckpointCreated
}: DocumentWorkspaceProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(session.name);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(session.description || "");
  const [pendingAfterId, setPendingAfterId] = useState<string | null>(null);
  const [currentNoteContent, setCurrentNoteContent] = useState(sessionNote?.content || "");
  const [noteResetToken, setNoteResetToken] = useState(0);

  useEffect(() => {
    setCurrentNoteContent(sessionNote?.content || "");
  }, [sessionNote?.$id, sessionNote?.$updatedAt, sessionNote?.content]);

  const handleTitleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!titleValue.trim() || titleValue === session.name) {
      setIsEditingTitle(false);
      return;
    }

    try {
      await updateSession(session.$id, { name: titleValue.trim() });
      setIsEditingTitle(false);
      onRefresh();
    } catch {
      setTitleValue(session.name);
      setIsEditingTitle(false);
    }
  };

  const handleDescSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (descValue.trim() === (session.description || "")) {
      setIsEditingDesc(false);
      return;
    }

    try {
      await updateSession(session.$id, { description: descValue.trim() || undefined });
      setIsEditingDesc(false);
      onRefresh();
    } catch {
      setDescValue(session.description || "");
      setIsEditingDesc(false);
    }
  };

  const handleSessionNoteSave = async (text: string) => {
    try {
      await upsertSessionNote(session.$id, text);
    } catch (err) {
      logError("Failed to save session note", err, { sessionId: session.$id });
      throw err;
    }
  };

  const startedLabel = new Date(session.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const handleCreateCheckpoint = async (name: string) => {
    const localStorageKey = `retrace_note_session_${session.$id}`;
    const mediaBoundaryKey = `${localStorageKey}:media_boundary`;
    let noteContent = currentNoteContent;

    try {
      const rawBuffer = window.localStorage.getItem(localStorageKey);
      if (rawBuffer) {
        const parsed = JSON.parse(rawBuffer) as { content?: unknown };
        if (typeof parsed.content === "string") noteContent = parsed.content;
      }
    } catch {
      // Fall back to the last loaded Appwrite content.
    }

    const withTimeout = async <T,>(promise: Promise<T>) => {
      let timeoutId: number | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("Creating checkpoint timed out. Please try again.")), uiDurations.checkpointCreateTimeoutMs);
      });
      try {
        return await Promise.race([promise, timeout]);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    };

    const sessionAttachments = attachmentsMap["session"] || [];
    const attachmentIds = sessionAttachments.map((attachment) => attachment.$id);
    const created = await withTimeout(
      createCheckpoint(session.$id, name, new Date().toISOString(), noteContent, { attachmentIds })
    );
    await withTimeout(upsertSessionNote(session.$id, ""));
    setCurrentNoteContent("");
    setNoteResetToken((value) => value + 1);
    try {
      window.localStorage.removeItem(localStorageKey);
      window.localStorage.removeItem(mediaBoundaryKey);
    } catch {
      // The persisted checkpoint is now the source of truth.
    }
    setPendingAfterId(null);
    onCheckpointCreated(created, attachmentIds);
  };

  return (
    <div className="w-full flex flex-col gap-0 font-body">
      {/* Session Title & Description */}
      <div className="mb-3 py-2">
        <div className="flex items-center justify-between group pr-8">
          {isEditingTitle ? (
            <form onSubmit={handleTitleSubmit} className="flex-1 max-w-xl">
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={() => handleTitleSubmit()}
                className="bg-transparent border-b border-primary text-2xl md:text-3xl font-heading font-bold text-text-primary focus:outline-none focus:ring-0 p-0 w-full"
                autoFocus
              />
            </form>
          ) : (
            <h1
              className="text-2xl md:text-3xl font-heading font-bold text-text-primary flex-1 cursor-pointer truncate"
              onClick={() => setIsEditingTitle(true)}
            >
              {session.name}
            </h1>
          )}

          <button
            onClick={() => setIsEditingTitle(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full text-text-muted hover:bg-neutral-soft hover:text-text-primary"
            title="Edit title"
            type="button"
          >
            <Icon name="pencil" className="h-4 w-4" />
          </button>
        </div>

        {/* Session Description */}
        <div className="flex items-center justify-between group mt-2 pr-8">
          {isEditingDesc ? (
            <form onSubmit={handleDescSubmit} className="flex-1 max-w-xl">
              <input
                type="text"
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={() => handleDescSubmit()}
                placeholder="Add a description..."
                className="bg-transparent border-b border-primary text-sm text-text-muted focus:outline-none focus:ring-0 p-0 w-full"
                autoFocus
              />
            </form>
          ) : (
            <p
              className={`text-sm text-text-muted cursor-pointer flex-1 ${!session.description ? "italic opacity-60" : ""}`}
              onClick={() => setIsEditingDesc(true)}
            >
              {session.description || "Click to add description..."}
            </p>
          )}

          <button
            onClick={() => setIsEditingDesc(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full text-text-muted hover:bg-neutral-soft hover:text-text-primary"
            title="Edit description"
            type="button"
          >
            <Icon name="pencil" className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
          <span>Started {startedLabel}</span>
          <span aria-hidden="true">-</span>
          <span>{session.captureCount} captures</span>
        </div>
      </div>

      {/* Current loose notes */}
      <div id="session-current-notes" className="mb-2 scroll-mt-8 rounded-card border border-border bg-surface px-6 py-5">
        <NoteArea
          key={`session-note-${sessionNote?.$updatedAt ?? "new"}-${sessionNote?.content?.length ?? 0}-${noteResetToken}`}
          sessionId={session.$id}
          checkpointId={null}
          initialValue={currentNoteContent}
          initialUpdatedAt={sessionNote?.$updatedAt ?? sessionNote?.createdAt}
          onSave={handleSessionNoteSave}
          onValueChange={setCurrentNoteContent}
          attachments={attachmentsMap["session"] || []}
          onAttachmentAdded={onAttachmentAdded}
          onAttachmentDeleted={onAttachmentDeleted}
          placeholder="Start writing general session notes here..."
        />
      </div>
      <CheckpointCreateControl
        isOpen={pendingAfterId === "session"}
        onOpen={() => setPendingAfterId("session")}
        onCancel={() => setPendingAfterId(null)}
        onCreate={handleCreateCheckpoint}
      />
    </div>
  );
}

interface CheckpointCreateControlProps {
  isOpen?: boolean;
  onOpen?: () => void;
  onCancel: () => void;
  onCreate: (name: string) => Promise<void>;
}

function CheckpointCreateControl({ isOpen = false, onOpen, onCancel, onCreate }: CheckpointCreateControlProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isSubmittingRef = React.useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setError("");
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      await onCreate(name.trim());
      setName("");
    } catch (err) {
      logError("Failed to create checkpoint", err);
      setError(err instanceof Error ? err.message : "Could not create checkpoint. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="mb-3 flex justify-end">
        <button
          onClick={onOpen}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-primary"
          type="button"
        >
          <Icon name="pin" className="h-3 w-3 text-text-muted transition-colors group-hover:text-primary" />
          <span>Add a checkpoint</span>
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3"
    >
      <div className="flex items-center gap-3">
        <Icon name="pin" className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          placeholder="Name this checkpoint..."
          autoComplete="off"
          className="h-10 flex-1 rounded-input border border-border bg-surface px-3 text-sm font-semibold text-text-primary outline-none transition-all placeholder:font-normal placeholder:text-text-muted focus:border-primary focus:ring-0"
          disabled={isSubmitting}
          autoFocus
        />
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-input border border-border bg-surface px-3 text-xs font-medium text-text-muted transition-colors hover:border-primary hover:text-primary"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="h-9 rounded-input border border-primary bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          disabled={isSubmitting || !name.trim()}
        >
          {isSubmitting ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </form>
  );
}
