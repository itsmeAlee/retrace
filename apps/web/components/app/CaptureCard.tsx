"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { timeAgo } from "../../lib/format";
import type { CaptureItem, CaptureType } from "../../lib/sessions";
import { getFileDownload, getFilePreview } from "../../lib/storage";
import { Icon } from "../Icon";

type CaptureCardProps = {
  capture: CaptureItem;
  onUpdated?: (capture: CaptureItem) => void;
};

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function CaptureCard({ capture }: CaptureCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <motion.article className="mb-2 flex gap-3 rounded-row border border-border bg-surface p-4 shadow-card" layout>
        <div className="flex h-icon-md w-icon-md shrink-0 items-center justify-center rounded-pill bg-bg text-primary">
          <Icon className="h-5 w-5" name={iconForType(capture.type)} />
        </div>
        <div className="min-w-0 flex-1">
          {capture.type === "image" ? (
            <ImageCapture capture={capture} onOpen={() => setLightboxOpen(true)} />
          ) : capture.type === "pdf" || capture.type === "file" ? (
            <FileCapture capture={capture} />
          ) : capture.type === "url" || capture.type === "video" ? (
            <>
              <p className="text-sm font-semibold text-text-primary">{capture.sourceTitle || capture.content}</p>
              <p className="break-words text-xs text-text-muted">
                {capture.type === "video" ? `YouTube · ${capture.sourceUrl || capture.content}` : capture.sourceUrl || capture.content}
              </p>
            </>
          ) : (
            <p className="line-clamp-3 text-sm leading-relaxed text-text-primary">{capture.content}</p>
          )}
          {capture.note ? <p className="mt-3 rounded-note bg-bg p-3 text-xs text-text-muted">{capture.note}</p> : null}
          <p className="mt-3 text-right text-xs text-text-muted">{timeAgo(capture.createdAt)}</p>
        </div>
      </motion.article>
      <AnimatePresence>
        {lightboxOpen && capture.fileId ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/90 p-6"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
          >
            <button className="absolute right-6 top-6 text-white" onClick={() => setLightboxOpen(false)} type="button">
              <Icon className="h-6 w-6" name="x" />
            </button>
            <img alt={capture.fileName || capture.content} className="max-h-full max-w-full rounded-form object-contain" src={getFilePreview(capture.fileId)} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ImageCapture({ capture, onOpen }: { capture: CaptureItem; onOpen: () => void }) {
  return (
    <div>
      <p className="text-sm font-semibold text-text-primary">{capture.fileName || capture.content}</p>
      {capture.fileId ? (
        <button className="mt-2 block w-full overflow-hidden rounded-form" onClick={onOpen} type="button">
          <img alt={capture.fileName || capture.content} className="max-h-44 w-full object-cover" src={getFilePreview(capture.fileId)} />
        </button>
      ) : null}
    </div>
  );
}

function FileCapture({ capture }: { capture: CaptureItem }) {
  const download = capture.fileId ? getFileDownload(capture.fileId) : "";
  return (
    <div>
      <p className="text-sm font-semibold text-text-primary">{capture.fileName || capture.content}</p>
      <p className="text-xs text-text-muted">
        {(capture.fileMimeType || (capture.type === "pdf" ? "PDF" : "Document")).split("/").pop()} · {formatBytes(capture.fileSize)}
      </p>
      {capture.type === "pdf" ? (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-form border border-border bg-bg">
            <Icon className="h-6 w-6 text-primary" name="document" />
          </div>
          <p className="text-xs text-text-muted">Preview unavailable</p>
        </div>
      ) : null}
      {download ? (
        <div className="mt-2 flex gap-2 text-sm">
          <a className="text-primary" href={download} rel="noreferrer" target="_blank">
            Open
          </a>
          <span className="text-text-muted">·</span>
          <a className="text-text-muted hover:text-primary" href={download}>
            Download
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function iconForType(type: CaptureType | "url"): "link" | "video" | "text" | "document" | "image" | "file" {
  if (type === "url") return "link";
  if (type === "video") return "video";
  if (type === "pdf") return "document";
  if (type === "image") return "image";
  if (type === "file") return "file";
  return "text";
}
