"use client";

import React, { useState } from "react";
import { Icon } from "../Icon";
import { NoteArea } from "./NoteArea";
import { CheckpointSection } from "./CheckpointSection";
import { AddCheckpointRow } from "./AddCheckpointRow";
import {
  updateSession,
  upsertSessionNote,
  type RetraceSession,
  type CaptureItem
} from "../../lib/sessions";

interface DocumentWorkspaceProps {
  session: RetraceSession;
  sessionNote: CaptureItem | null;
  checkpoints: CaptureItem[];
  attachmentsMap: Record<string, CaptureItem[]>;
  expandedId: string | null;
  onToggleCheckpoint: (id: string) => void;
  onRefresh: () => void;
  onAttachmentAdded: (item: CaptureItem) => void;
  onAttachmentDeleted: (id: string) => void;
  onCheckpointCreated: (id: string) => void;
  checkpointRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export function DocumentWorkspace({
  session,
  sessionNote,
  checkpoints,
  attachmentsMap,
  expandedId,
  onToggleCheckpoint,
  onRefresh,
  onAttachmentAdded,
  onAttachmentDeleted,
  onCheckpointCreated,
  checkpointRefs
}: DocumentWorkspaceProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(session.name);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(session.description || "");

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
      console.error("Failed to save session note:", err);
      throw err;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 font-body">
      {/* Session Title & Description */}
      <div className="border-b border-border pb-5">
        <div className="flex items-center justify-between group">
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
        <div className="flex items-center justify-between group mt-2">
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
      </div>

      {/* Main General Session Note */}
      <div className="pb-6">
        <NoteArea
          sessionId={session.$id}
          checkpointId={null}
          initialValue={sessionNote?.content || ""}
          initialUpdatedAt={sessionNote?.$updatedAt ?? sessionNote?.createdAt}
          onSave={handleSessionNoteSave}
          attachments={attachmentsMap["session"] || []}
          onAttachmentAdded={onAttachmentAdded}
          onAttachmentDeleted={onAttachmentDeleted}
          placeholder="Start writing general session notes here..."
          toolbarAction={
            <AddCheckpointRow
              sessionId={session.$id}
              onCheckpointCreated={onCheckpointCreated}
              variant="toolbar"
            />
          }
        />
      </div>

      {/* Checkpoints */}
      <div className="mt-4">
        {/* Checkpoints timeline */}
        <div className="flex flex-col">
          {checkpoints.map((cp) => (
            <div
              key={cp.$id}
              ref={(el) => {
                checkpointRefs.current[cp.$id] = el;
              }}
            >
              <CheckpointSection
                sessionId={session.$id}
                checkpoint={cp}
                attachments={attachmentsMap[cp.$id] || []}
                isExpanded={expandedId === cp.$id}
                onToggle={() => onToggleCheckpoint(cp.$id)}
                onUpdate={onRefresh}
                onAttachmentAdded={onAttachmentAdded}
                onAttachmentDeleted={onAttachmentDeleted}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
