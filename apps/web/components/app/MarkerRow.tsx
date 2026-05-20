"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { KeyboardEvent, useEffect, useState } from "react";
import { timeAgo } from "../../lib/format";
import { getCaptureDetails } from "../../lib/sessions";
import type { CaptureItem } from "../../lib/sessions";
import { Icon } from "../Icon";

type MarkerRowProps = {
  marker: CaptureItem;
  onEdit: (note: string) => void;
  onDelete?: () => void;
};

export function MarkerRow({ marker, onEdit, onDelete }: MarkerRowProps) {
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState(marker.markerNote ?? marker.note ?? "");
  const [aiSummary, setAiSummary] = useState(marker.aiSummary);

  useEffect(() => setNote(marker.markerNote ?? marker.note ?? ""), [marker.markerNote, marker.note]);

  function save() {
    setEditing(false);
    onEdit(note.trim());
  }

  async function beginEdit() {
    const details = await getCaptureDetails(marker.$id).catch(() => null);
    if (details?.markerNote !== undefined) setNote(details.markerNote ?? "");
    if (details?.aiSummary !== undefined) setAiSummary(details.aiSummary ?? undefined);
    setEditing(true);
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  }

  return (
    <motion.div className="group my-4" layout>
      <div className="h-px bg-border" />
      <div className="flex py-4">
        <div className="mr-4 w-1 rounded-pill bg-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-primary" name="pin" />
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Marker</span>
            </div>
            <span className="shrink-0 text-xs text-text-muted">{timeAgo(marker.createdAt)}</span>
          </div>

          {editing ? (
            <textarea
              autoFocus
              className="mt-2 min-h-20 w-full resize-none rounded-form border-[1.5px] border-border bg-surface px-3 py-2 text-sm italic text-primary outline-none focus:border-primary focus:shadow-focus"
              onBlur={save}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={handleKey}
              value={note}
            />
          ) : (
            <p className={`mt-2 text-sm ${note ? "italic text-primary" : "text-text-muted"}`}>{note || "No note added."}</p>
          )}

          <div className="mt-3 rounded-form bg-bg p-3">
            <div className="flex items-center gap-2">
              <Icon className="h-3 w-3 text-text-muted" name="sparkle" />
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">AI Summary</span>
            </div>
            {aiSummary ? (
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{aiSummary}</p>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="h-3 w-5/6 animate-pulse rounded-pill bg-neutral-soft" />
                <div className="h-3 w-2/3 animate-pulse rounded-pill bg-neutral-soft" />
                <p className="text-xs text-text-muted">Generating summary...</p>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {["text", "links", "files"].map((label) => (
                <span className="rounded-pill bg-neutral-soft px-2 py-0.5 text-xs text-text-muted" key={label}>
                  {label} 0
                </span>
              ))}
            </div>
          </div>

          <AnimatePresence>
            <motion.div
              animate={{ opacity: 1 }}
              className="mt-2 flex items-center gap-2 text-sm text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
              exit={{ opacity: 0 }}
              initial={{ opacity: reduce ? 1 : 0 }}
            >
              {confirming ? (
                <>
                  <span>Sure?</span>
                  <button className="hover:text-error" onClick={onDelete} type="button">
                    Yes
                  </button>
                  <span>·</span>
                  <button className="hover:text-primary" onClick={() => setConfirming(false)} type="button">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="hover:text-primary" onClick={() => void beginEdit()} type="button">
                    Edit note
                  </button>
                  <span>·</span>
                  <button className="hover:text-error" onClick={() => setConfirming(true)} type="button">
                    Delete marker
                  </button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="h-px bg-border" />
    </motion.div>
  );
}
