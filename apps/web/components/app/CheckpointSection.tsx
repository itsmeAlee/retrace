"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../Icon";
import { InlineMediaList } from "./InlineMediaList";
import { NoteArea } from "./NoteArea";
import {
  renameCheckpoint,
  updateCheckpointNote,
  deleteCheckpoint,
  type CaptureItem
} from "../../lib/sessions";

interface CheckpointSectionProps {
  sessionId: string;
  checkpoint: CaptureItem;
  index: number;
  attachments: CaptureItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: () => void;
  onAttachmentAdded: (item: CaptureItem) => void;
  onAttachmentDeleted: (item: CaptureItem) => void;
}

export function CheckpointSection({
  sessionId,
  checkpoint,
  index,
  attachments,
  isExpanded,
  onToggle,
  onUpdate,
  onAttachmentAdded,
  onAttachmentDeleted
}: CheckpointSectionProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [nameValue, setNameValue] = useState(checkpoint.checkpointName || "Untitled Checkpoint");
  const [viewContent, setViewContent] = useState(checkpoint.content || "");
  const [isDeleting, setIsDeleting] = useState(false);
  const editStartValueRef = useRef(checkpoint.content || "");
  const checkpointLabel = checkpoint.checkpointName || "Untitled Checkpoint";
  const numberedLabel = `${index + 1}. ${checkpointLabel}`;
  const contentId = `checkpoint-content-${checkpoint.$id}`;

  const timestampMs = useCallback((value?: string) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }, []);

  const getLatestContent = useCallback(() => {
    const remoteContent = checkpoint.content || "";
    const remoteMs = timestampMs(checkpoint.$updatedAt ?? checkpoint.createdAt);
    try {
      const rawBuffer = window.localStorage.getItem(`retrace_note_checkpoint_${checkpoint.$id}`);
      if (!rawBuffer) return remoteContent;
      const parsed = JSON.parse(rawBuffer) as { content?: unknown; updatedAt?: unknown };
      if (typeof parsed.content !== "string" || typeof parsed.updatedAt !== "string") return remoteContent;
      return timestampMs(parsed.updatedAt) > remoteMs ? parsed.content : remoteContent;
    } catch {
      return remoteContent;
    }
  }, [checkpoint.$id, checkpoint.$updatedAt, checkpoint.content, checkpoint.createdAt, timestampMs]);

  useEffect(() => {
    setNameValue(checkpointLabel);
  }, [checkpoint.$id, checkpointLabel]);

  useEffect(() => {
    if (isEditingNote) return;
    const latestContent = getLatestContent();
    setViewContent(latestContent);
    editStartValueRef.current = latestContent;
  }, [getLatestContent, isEditingNote]);

  const handleRenameSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameValue.trim() || nameValue === checkpoint.checkpointName) {
      setIsEditingName(false);
      return;
    }

    try {
      await renameCheckpoint(checkpoint.$id, nameValue.trim());
      setIsEditingName(false);
      onUpdate();
    } catch {
      setNameValue(checkpoint.checkpointName || "Untitled Checkpoint");
      setIsEditingName(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this checkpoint and all its attachments?")) return;
    setIsDeleting(true);
    try {
      await deleteCheckpoint(checkpoint.$id);
      onUpdate();
    } catch {
      setIsDeleting(false);
    }
  };

  const handleNoteSave = async (text: string) => {
    try {
      await updateCheckpointNote(checkpoint.$id, text);
    } catch (err) {
      console.error("Failed to save checkpoint note:", err);
      throw err;
    }
  };

  const enterEditMode = () => {
    const latestContent = getLatestContent();
    editStartValueRef.current = latestContent;
    setViewContent(latestContent);
    setIsEditingNote(true);
  };

  const exitEditMode = () => {
    setIsEditingNote(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isExpanded) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if ((event.key === "e" || event.key === "E") && !isEditingNote) {
      event.preventDefault();
      enterEditMode();
      return;
    }

    if (event.key === "Escape" && isEditingNote && viewContent === editStartValueRef.current) {
      event.preventDefault();
      exitEditMode();
    }
  };

  return (
    <div
      className={`group mb-2 rounded-card border border-border bg-surface px-5 py-3 font-body transition-all duration-200 ${
        isDeleting ? "pointer-events-none opacity-30" : ""
      } ${isExpanded ? "shadow-card" : "cursor-pointer hover:border-primary/40 hover:bg-surface-hover"} focus:outline-none focus-visible:shadow-focus`}
      onClick={() => {
        if (!isExpanded && !isEditingName) onToggle();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center">
          {isEditingName ? (
            <form onSubmit={handleRenameSubmit} className="flex min-w-0 items-center gap-2">
              <Icon name="pin" className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => handleRenameSubmit()}
                className="h-8 w-56 rounded-input border border-border bg-surface px-3 text-sm font-semibold text-text-primary outline-none transition-all focus:border-primary focus:ring-0"
                onClick={(event) => event.stopPropagation()}
                autoFocus
              />
            </form>
          ) : (
            <button
              aria-controls={contentId}
              aria-expanded={isExpanded}
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              className="inline-flex min-w-0 items-center gap-2 rounded-note border border-border bg-neutral-soft px-3 py-1.5 text-primary transition-colors hover:border-primary/40 hover:bg-surface-hover focus:outline-none focus-visible:border-primary/40 focus-visible:shadow-focus"
              type="button"
            >
              <Icon name="pin" className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate text-sm font-semibold">{numberedLabel}</span>
              <Icon
                name="chevron-down"
                className={`h-3.5 w-3.5 flex-shrink-0 text-text-muted transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {isExpanded && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (isEditingNote) {
                  exitEditMode();
                } else {
                  enterEditMode();
                }
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-input border border-border bg-surface px-3 text-xs font-medium text-text-muted transition-colors hover:border-primary hover:text-primary"
              type="button"
            >
              {isEditingNote ? (
                "Done"
              ) : (
                <>
                  <Icon name="pencil" className="h-3 w-3" />
                  <span>Edit</span>
                </>
              )}
            </button>
          )}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.stopPropagation();
              setIsEditingName(true);
            }}
            className="rounded-full p-1 text-text-muted transition-colors hover:bg-neutral-soft hover:text-text-primary"
            title="Rename checkpoint"
            type="button"
          >
            <Icon name="pencil" className="h-3 w-3" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleDelete();
            }}
            className="rounded-full p-1 text-text-muted transition-colors hover:bg-error/10 hover:text-error"
            title="Delete checkpoint"
            type="button"
          >
            <Icon name="delete" className="h-3 w-3" />
          </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 border-t border-border pt-3">
              {isEditingNote ? (
                <NoteArea
                  sessionId={sessionId}
                  checkpointId={checkpoint.$id}
                  initialValue={viewContent}
                  initialUpdatedAt={checkpoint.$updatedAt ?? checkpoint.createdAt}
                  onSave={handleNoteSave}
                  onValueChange={setViewContent}
                  attachments={attachments}
                  onAttachmentAdded={onAttachmentAdded}
                  onAttachmentDeleted={onAttachmentDeleted}
                  placeholder="Write notes for this checkpoint..."
                />
              ) : (
                <CheckpointReadOnlyContent content={viewContent} attachments={attachments} />
              )}
              {checkpoint.aiSummary && (
                <div className="mt-4 rounded-card border border-border bg-surface p-5 shadow-card">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                    <Icon name="sparkle" className="h-4 w-4 fill-current text-accent" />
                    <span>AI Summary</span>
                  </div>
                  <p className="font-body text-sm leading-relaxed text-text-primary">{checkpoint.aiSummary}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckpointReadOnlyContent({
  attachments,
  content
}: {
  attachments: CaptureItem[];
  content: string;
}) {
  return (
    <div className="font-body">
      {content.trim() ? (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-text-primary">{content}</p>
      ) : (
        <p className="text-sm italic leading-relaxed text-text-muted">No notes captured in this checkpoint.</p>
      )}
      <InlineMediaList attachments={attachments} />
    </div>
  );
}
