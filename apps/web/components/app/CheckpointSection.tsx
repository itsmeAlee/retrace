"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../Icon";
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
  attachments: CaptureItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: () => void;
  onAttachmentAdded: (item: CaptureItem) => void;
  onAttachmentDeleted: (id: string) => void;
}

export function CheckpointSection({
  sessionId,
  checkpoint,
  attachments,
  isExpanded,
  onToggle,
  onUpdate,
  onAttachmentAdded,
  onAttachmentDeleted
}: CheckpointSectionProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(checkpoint.checkpointName || "Untitled Checkpoint");
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <div className={`border-b border-border font-body transition-all duration-300 ${isDeleting ? "opacity-30 pointer-events-none" : ""}`}>
      {/* Header / Collapse Bar */}
      <div className="flex items-center justify-between py-4 group cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3 flex-1 min-w-0" onClick={(e) => isEditingName && e.stopPropagation()}>
          {/* Collapse indicator */}
          <button
            type="button"
            className="text-text-muted hover:text-text-primary p-1"
          >
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <Icon name="play" className="h-3 w-3 fill-current text-text-muted" />
            </motion.div>
          </button>

          {isEditingName ? (
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => handleRenameSubmit()}
                className="bg-transparent border-b border-primary text-lg font-heading font-semibold text-text-primary focus:outline-none focus:ring-0 p-0 w-full"
                autoFocus
              />
            </form>
          ) : (
            <h3 className="text-lg font-heading font-semibold text-text-primary truncate">
              {checkpoint.checkpointName || "Untitled Checkpoint"}
            </h3>
          )}
        </div>

        {/* Action button overlay on hover */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setIsEditingName(true)}
            className="p-1.5 rounded-full text-text-muted hover:bg-neutral-soft hover:text-text-primary transition-all"
            title="Rename checkpoint"
            type="button"
          >
            <Icon name="pencil" className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-full text-text-muted hover:bg-error/10 hover:text-error transition-all"
            title="Delete checkpoint"
            type="button"
          >
            <Icon name="delete" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Accordion Note / Attachments Panel */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 20 }}
            className="overflow-hidden"
          >
            <div className="pl-7 pb-6 pr-2">
              {/* AI Summary Block (Premium White Box) */}
              {checkpoint.aiSummary && (
                <div className="bg-white border border-border shadow-card rounded-card p-5 mt-1 mb-5 relative group">
                  <div className="flex items-center gap-2 text-accent font-semibold text-xs uppercase tracking-wider mb-2">
                    <Icon name="sparkle" className="h-4 w-4 text-accent fill-current" />
                    <span>AI Key Summary</span>
                  </div>
                  <p className="text-sm text-text-primary leading-relaxed font-body">
                    {checkpoint.aiSummary}
                  </p>
                </div>
              )}

              {/* Note Content Area */}
              <NoteArea
                sessionId={sessionId}
                checkpointId={checkpoint.$id}
                initialValue={checkpoint.content || ""}
                initialUpdatedAt={checkpoint.$updatedAt ?? checkpoint.createdAt}
                onSave={handleNoteSave}
                attachments={attachments}
                onAttachmentAdded={onAttachmentAdded}
                onAttachmentDeleted={onAttachmentDeleted}
                placeholder="Write notes for this checkpoint..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
