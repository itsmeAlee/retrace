"use client";

import React, { useState } from "react";
import { Icon } from "../Icon";
import { createCheckpoint } from "../../lib/sessions";

interface AddCheckpointRowProps {
  sessionId: string;
  onCheckpointCreated: (checkpointId: string) => void;
  variant?: "default" | "toolbar";
}

export function AddCheckpointRow({ sessionId, onCheckpointCreated, variant = "default" }: AddCheckpointRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await createCheckpoint(sessionId, name.trim());
      setName("");
      setIsOpen(false);
      onCheckpointCreated(created.$id);
    } catch (err) {
      console.error("Failed to create checkpoint:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={variant === "toolbar" ? "font-body" : "mt-6 flex justify-end font-body"}>
      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          className={
            variant === "toolbar"
              ? "flex min-w-72 items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1 shadow-sm transition-all focus-within:border-primary focus-within:shadow-focus"
              : "flex w-full max-w-xl items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 shadow-sm transition-all focus-within:border-primary focus-within:shadow-focus"
          }
        >
          <Icon name="pin" className="h-4 w-4 text-accent flex-shrink-0" />
          <input
            type="text"
            placeholder="Checkpoint title (e.g., Deep Learning Basics)..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-transparent text-sm text-text-primary outline-none focus:ring-0 placeholder-text-muted"
            disabled={isSubmitting}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all hover:bg-primary-hover disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Add"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className={
            variant === "toolbar"
              ? "inline-flex h-8 items-center gap-2 rounded-pill bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
              : "inline-flex h-10 items-center gap-2.5 rounded-pill border border-border bg-surface px-4 text-sm font-medium text-text-muted transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          }
          type="button"
        >
          <div className={variant === "toolbar" ? "flex h-5 w-5 items-center justify-center rounded-full bg-white/15" : "flex h-6 w-6 items-center justify-center rounded-full bg-neutral-soft transition-colors"}>
            <Icon name="add" className={variant === "toolbar" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </div>
          <span>{variant === "toolbar" ? "New checkpoint" : "Create new checkpoint"}</span>
        </button>
      )}
    </div>
  );
}
