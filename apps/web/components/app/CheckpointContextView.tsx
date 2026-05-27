"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import type { SourceReference } from "../../types/checkpoint";
import { Icon } from "../Icon";
import { Mermaid } from "../Mermaid";
import { getFileDownload, getFilePreview } from "../../lib/storage";
import { CheckpointSection } from "./CheckpointSection";
import {
  getCheckpointAttachments,
  getCheckpointWithAI,
  pollCheckpointAiStatus,
  type CaptureItem,
  type CheckpointWithAI
} from "../../lib/sessions";

interface CheckpointContextViewProps {
  checkpointId: string;
  checkpointName: string;
  sessionId: string;
  onBack: () => void;
  onContinue: () => void;
}

export function CheckpointContextView({
  checkpointId,
  checkpointName,
  sessionId,
  onBack,
  onContinue
}: CheckpointContextViewProps) {
  const [checkpoint, setCheckpoint] = useState<CheckpointWithAI | null>(null);
  const [attachments, setAttachments] = useState<CaptureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOriginalOpen, setIsOriginalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let cleanupPoll: (() => void) | undefined;

    async function loadCheckpoint() {
      setIsLoading(true);
      setError("");
      setCheckpoint(null);
      setAttachments([]);
      setIsOriginalOpen(false);

      try {
        const [loadedCheckpoint, loadedAttachments] = await Promise.all([
          getCheckpointWithAI(checkpointId),
          getCheckpointAttachments(checkpointId).catch(() => [])
        ]);
        if (!isMounted) return;

        setCheckpoint(loadedCheckpoint);
        setAttachments(loadedAttachments);
        setIsLoading(false);

        if (isProcessingStatus(loadedCheckpoint.aiStatus)) {
          cleanupPoll = pollCheckpointAiStatus(
            checkpointId,
            (data) => {
              if (!isMounted) return;
              const updated = { ...loadedCheckpoint, ...data };
              setCheckpoint(updated);
            },
            (data) => {
              if (!isMounted) return;
              setCheckpoint((current) => {
                if (!current) return current;
                const updated = { ...current, ...data, aiStatus: "failed" as const };
                return updated;
              });
            }
          );
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || "Could not load checkpoint.");
        setIsLoading(false);
      }
    }

    void loadCheckpoint();

    return () => {
      isMounted = false;
      cleanupPoll?.();
    };
  }, [checkpointId, reloadToken]);

  const displayName = checkpoint?.checkpointName || checkpointName || "Untitled Checkpoint";
  const aiStatus = checkpoint?.aiStatus || "pending";
  const timestamp = checkpoint ? formatCheckpointTimestamp(checkpoint.createdAt) : "";
  const captureCount = checkpoint?.aiCaptureCount ?? attachments.length;

  return (
    <div className="w-full font-body">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-primary"
          type="button"
        >
          <Icon className="h-4 w-4" name="arrow-left" />
          Back
        </button>
        <span className="min-w-0 truncate text-right text-sm text-text-muted">
          {displayName}
          {timestamp ? <span className="ml-2">{timestamp}</span> : null}
        </span>
      </div>

      <div className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
        {isLoading ? (
          <LoadingContext />
        ) : error || aiStatus === "failed" ? (
          <FailedContext
            details={error || checkpoint?.aiError}
            onRetry={() => setReloadToken((value) => value + 1)}
          />
        ) : isProcessingStatus(aiStatus) || aiStatus !== "complete" ? (
          <LoadingContext />
        ) : (
          checkpoint && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="font-heading text-[22px] font-semibold leading-tight text-primary">
                {checkpoint.aiTitle || displayName}
              </h2>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">AI Context</p>

              {checkpoint.aiContext ? (
                <p className="mt-4 whitespace-pre-wrap text-[15px] leading-[1.75] text-text-primary">
                  {checkpoint.aiContext}
                </p>
              ) : (
                <p className="mt-4 text-[15px] italic leading-[1.75] text-text-muted">No context is available yet.</p>
              )}

              {checkpoint.aiKeyPoints.length > 0 && (
                <section className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Key Points</p>
                  <div className="mt-2 flex flex-col gap-2.5">
                    {checkpoint.aiKeyPoints.slice(0, 8).map((point, index) => (
                      <div key={`${point}-${index}`} className="flex items-start gap-3">
                        <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        <p className="text-sm leading-6 text-text-primary">{point}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {checkpoint.aiSourcesUsed.length > 0 && (
                <section className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Sources Referenced</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {checkpoint.aiSourcesUsed.map((source, index) => (
                      <SourceChip
                        key={`${source.title}-${source.file_id || source.url || index}`}
                        source={source}
                        onPreviewImage={(src, title) => setImagePreview({ src, title })}
                      />
                    ))}
                  </div>
                </section>
              )}

              {checkpoint.aiDiagrams.length > 0 && (
                <section className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Concept Diagrams</p>
                  <div className="mt-2 flex flex-col gap-3">
                    {checkpoint.aiDiagrams.map((diagram, index) => (
                      <div key={`${diagram.diagram_type}-${index}`} className="rounded-lg border border-border bg-surface p-4">
                        <p className="mb-2 text-sm font-medium text-text-primary">{diagram.diagram_type}</p>
                        <Mermaid chart={diagram.mermaid_code} hideOnError />
                        {diagram.explanation ? <p className="mt-2 text-xs text-text-muted">{diagram.explanation}</p> : null}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-5 border-t border-border pt-3">
                <p className="text-xs text-text-muted">AI analyzed {captureCount} captures</p>
              </div>
            </motion.div>
          )
        )}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs italic text-text-muted">View what you originally captured in this checkpoint</p>
        <button
          onClick={() => setIsOriginalOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-note py-2 text-left transition-colors hover:text-primary"
          type="button"
        >
          <span className="text-sm font-medium text-text-primary">Original notes & captures</span>
          <motion.span
            animate={{ rotate: isOriginalOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="text-sm text-text-muted"
          >
            <Icon name="chevron-down" className="h-4 w-4" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {isOriginalOpen && checkpoint && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <CheckpointSection
                  sessionId={sessionId}
                  checkpoint={{
                    ...checkpoint,
                    content: checkpoint.noteContent ?? checkpoint.content ?? ""
                  }}
                  index={0}
                  attachments={attachments}
                  isExpanded
                  isLocked
                  onToggle={() => setIsOriginalOpen((open) => !open)}
                  onUpdate={() => {}}
                  onAttachmentAdded={() => {}}
                  onAttachmentDeleted={() => {}}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-card border border-border bg-surface px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">Ready to keep going?</p>
          <p className="text-xs text-text-muted">Return to the live session notes and add the next capture.</p>
        </div>
        <button
          onClick={onContinue}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary/5 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="pencil" />
          Add more notes
        </button>
      </div>

      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setImagePreview(null)}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="relative max-h-[88vh] max-w-[92vw]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                aria-label="Close image preview"
                className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-primary shadow-card transition-colors hover:text-primary"
                onClick={() => setImagePreview(null)}
                type="button"
              >
                <Icon className="h-4 w-4" name="x" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element -- Appwrite preview URLs are already transformed by the storage API. */}
              <img
                alt={imagePreview.title}
                className="max-h-[88vh] max-w-[92vw] rounded-card object-contain shadow-card"
                src={imagePreview.src}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingContext() {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-primary">Synthesizing checkpoint...</h2>
        <div className="flex items-center gap-2 text-accent">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <span className="text-sm font-medium">Processing</span>
        </div>
      </div>
      <div className="mt-5 space-y-3 animate-pulse">
        <div className="h-3.5 w-4/5 rounded-full bg-neutral-soft" />
        <div className="h-3.5 w-full rounded-full bg-neutral-soft" />
        <div className="h-3.5 w-11/12 rounded-full bg-neutral-soft" />
        <div className="h-3.5 w-3/5 rounded-full bg-neutral-soft" />
      </div>
      <p className="mt-4 text-center text-sm italic text-text-muted">AI is analyzing your captures...</p>
    </div>
  );
}

function FailedContext({ details, onRetry }: { details?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-[15px] text-text-muted">Context unavailable.</p>
      {details ? <p className="mt-1 max-w-md text-xs text-text-muted">{details}</p> : null}
      <button
        onClick={onRetry}
        className="mt-3 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

function isProcessingStatus(status?: string) {
  return status === "processing" || status === "pending";
}

function SourceChip({
  source,
  onPreviewImage
}: {
  source: SourceReference;
  onPreviewImage: (src: string, title: string) => void;
}) {
  const type = source.source_type.toLowerCase();
  const label = getSourceLabel(source, type);
  const iconName = getSourceIcon(type);
  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-text-muted transition-colors";

  if ((type === "youtube" || type === "url") && source.url) {
    return (
      <a
        className={`${className} hover:border-primary hover:text-primary`}
        href={source.url}
        rel="noreferrer"
        target="_blank"
      >
        <Icon className="h-3.5 w-3.5" name={iconName} />
        {label}
      </a>
    );
  }

  if (type === "image" && source.file_id) {
    return (
      <button
        className={`${className} hover:border-primary hover:text-primary`}
        onClick={() => onPreviewImage(getFilePreview(source.file_id as string), source.title || "Image source")}
        type="button"
      >
        <Icon className="h-3.5 w-3.5" name={iconName} />
        {label}
      </button>
    );
  }

  if ((type === "pdf" || type === "file") && source.file_id) {
    return (
      <a
        className={`${className} hover:border-primary hover:text-primary`}
        href={getFileDownload(source.file_id as string)}
        rel="noreferrer"
        target="_blank"
      >
        <Icon className="h-3.5 w-3.5" name={iconName} />
        {label}
      </a>
    );
  }

  return (
    <span className={className}>
      <Icon className="h-3.5 w-3.5" name={iconName} />
      {label}
    </span>
  );
}

function getSourceLabel(source: SourceReference, type: string) {
  if (type === "youtube") return "YouTube";
  if (type === "url") return source.domain || source.title || "Website";
  return source.title || type || "Source";
}

function getSourceIcon(type: string): "document" | "file" | "image" | "link" | "mic" | "text" | "video" {
  if (type === "youtube") return "video";
  if (type === "url") return "link";
  if (type === "image") return "image";
  if (type === "audio") return "mic";
  if (type === "text") return "text";
  if (type === "pdf") return "document";
  return "file";
}

function formatCheckpointTimestamp(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day} - ${time}`;
}
