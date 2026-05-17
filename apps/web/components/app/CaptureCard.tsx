"use client";

import { motion } from "framer-motion";
import { timeAgo } from "../../lib/format";
import type { CaptureItem, CaptureType } from "../../lib/sessions";
import { Icon } from "../Icon";

type CaptureCardProps = {
  capture: CaptureItem;
};

export function CaptureCard({ capture }: CaptureCardProps) {
  return (
    <motion.article className="mb-2 flex gap-3 rounded-row border border-border bg-surface p-4 shadow-card" layout>
      <div className="flex h-icon-md w-icon-md shrink-0 items-center justify-center rounded-pill bg-bg text-primary">
        <Icon className="h-5 w-5" name={iconForType(capture.type)} />
      </div>
      <div className="min-w-0 flex-1">
        {capture.type === "url" || capture.type === "video" ? (
          <>
            <p className="text-sm font-semibold text-text-primary">{capture.sourceTitle || capture.content}</p>
            <p className="break-words text-xs text-text-muted">
              {capture.type === "video" ? `YouTube · ${capture.sourceUrl || capture.content}` : capture.sourceUrl || capture.content}
            </p>
          </>
        ) : (
          <p className={`line-clamp-3 text-sm leading-relaxed text-text-primary ${capture.type === "note" ? "italic" : ""}`}>{capture.content}</p>
        )}
        {capture.note ? <p className="mt-3 rounded-note bg-bg p-3 text-xs text-text-muted">{capture.note}</p> : null}
        <p className="mt-3 text-right text-xs text-text-muted">{timeAgo(capture.createdAt)}</p>
      </div>
    </motion.article>
  );
}

export function iconForType(type: CaptureType | "url"): "link" | "video" | "note" | "text" {
  if (type === "url") return "link";
  if (type === "video") return "video";
  if (type === "note") return "note";
  return "text";
}
