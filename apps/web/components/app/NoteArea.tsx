"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AttachmentToolbar } from "./AttachmentToolbar";
import { type CaptureItem } from "../../lib/sessions";

interface NoteAreaProps {
  sessionId: string;
  checkpointId: string | null;
  initialValue: string;
  initialUpdatedAt?: string;
  onSave: (val: string) => Promise<void>;
  onValueChange?: (val: string) => void;
  placeholder?: string;
  attachments?: CaptureItem[];
  onAttachmentAdded: (item: CaptureItem) => void;
  onAttachmentDeleted?: (id: string) => void;
}

export function NoteArea({
  sessionId,
  checkpointId,
  initialValue,
  initialUpdatedAt,
  onSave,
  onValueChange,
  placeholder = "Start writing here...",
  attachments = [],
  onAttachmentAdded,
  onAttachmentDeleted
}: NoteAreaProps) {
  type SaveStatus = "saved" | "saving" | "local";
  type LocalNoteBuffer = {
    content: string;
    updatedAt: string;
  };

  const localStorageKey = checkpointId ? `retrace_note_checkpoint_${checkpointId}` : `retrace_note_session_${sessionId}`;
  const [value, setValue] = useState(initialValue);
  const [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [showSavedStatus, setShowSavedStatus] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentKey = checkpointId ?? `session:${sessionId}`;
  const documentKeyRef = useRef(documentKey);
  const localStorageKeyRef = useRef(localStorageKey);
  const valueRef = useRef(initialValue);
  const lastSavedValueRef = useRef(initialValue);
  const focusedRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveVersionRef = useRef(0);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const readLocalBuffer = useCallback((key: string): LocalNoteBuffer | null => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LocalNoteBuffer>;
      if (typeof parsed.content !== "string" || typeof parsed.updatedAt !== "string") return null;
      return { content: parsed.content, updatedAt: parsed.updatedAt };
    } catch {
      return null;
    }
  }, []);

  const writeLocalBuffer = useCallback((key: string, content: string) => {
    const updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(key, JSON.stringify({ content, updatedAt }));
    } catch {
      setSaveError("Could not save locally. Browser storage may be full.");
    }
    return updatedAt;
  }, []);

  const clearLocalBuffer = useCallback((key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing useful to do here; the Appwrite save has already succeeded.
    }
  }, []);

  const timestampMs = useCallback((value?: string) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }, []);

  const saveNow = useCallback(
    async (nextValue: string, bufferUpdatedAt?: string) => {
      const saveVersion = ++saveVersionRef.current;
      const key = localStorageKeyRef.current;
      setSaveStatus("saving");
      setSaveError("");

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveStatus("local");
        return;
      }

      try {
        await onSaveRef.current(nextValue);
        if (saveVersion !== saveVersionRef.current || valueRef.current !== nextValue) return;

        const currentBuffer = readLocalBuffer(key);
        const currentBufferMatchesSave =
          !currentBuffer ||
          !bufferUpdatedAt ||
          (currentBuffer.updatedAt === bufferUpdatedAt && currentBuffer.content === nextValue);

        lastSavedValueRef.current = nextValue;
        dirtyRef.current = !currentBufferMatchesSave;
        if (currentBufferMatchesSave) {
          clearLocalBuffer(key);
          setSaveStatus("saved");
        } else {
          setSaveStatus("saving");
        }
      } catch (err) {
        console.error("Failed to save note:", err);
        if (saveVersion === saveVersionRef.current) {
          setSaveStatus("local");
          setSaveError("");
        }
      }
    },
    [clearLocalBuffer, readLocalBuffer]
  );

  useEffect(() => {
    const remoteMs = timestampMs(initialUpdatedAt);
    const localBuffer = readLocalBuffer(localStorageKey);
    const hasNewerLocal = localBuffer ? timestampMs(localBuffer.updatedAt) > remoteMs : false;

    if (documentKeyRef.current !== documentKey) {
      documentKeyRef.current = documentKey;
      localStorageKeyRef.current = localStorageKey;
      const nextValue = hasNewerLocal && localBuffer ? localBuffer.content : initialValue;
      valueRef.current = nextValue;
      lastSavedValueRef.current = initialValue;
      dirtyRef.current = hasNewerLocal;
      setValue(nextValue);
      onValueChange?.(nextValue);
      setSaveError("");
      setSaveStatus(hasNewerLocal ? "local" : "saved");
      if (hasNewerLocal && localBuffer) {
        void saveNow(localBuffer.content, localBuffer.updatedAt);
      } else if (localBuffer) {
        clearLocalBuffer(localStorageKey);
      }
      return;
    }

    if (hasNewerLocal && localBuffer && !dirtyRef.current) {
      valueRef.current = localBuffer.content;
      dirtyRef.current = true;
      setValue(localBuffer.content);
      onValueChange?.(localBuffer.content);
      setSaveStatus("local");
      void saveNow(localBuffer.content, localBuffer.updatedAt);
      return;
    }

    if (!focusedRef.current && !dirtyRef.current && initialValue !== lastSavedValueRef.current) {
      valueRef.current = initialValue;
      lastSavedValueRef.current = initialValue;
      setValue(initialValue);
      onValueChange?.(initialValue);
      setSaveStatus("saved");
      if (localBuffer && !hasNewerLocal) {
        clearLocalBuffer(localStorageKey);
      }
    }
  }, [clearLocalBuffer, documentKey, initialUpdatedAt, initialValue, localStorageKey, onValueChange, readLocalBuffer, saveNow, timestampMs]);

  // Adjust height on text value change
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight, value]);

  useEffect(() => {
    if (saveStatus !== "saved") {
      setShowSavedStatus(false);
      return;
    }

    setShowSavedStatus(true);
    const timeout = window.setTimeout(() => setShowSavedStatus(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  const scheduleSave = useCallback(
    (nextValue: string, bufferUpdatedAt: string) => {
      dirtyRef.current = true;
      setSaveError("");
      setSaveStatus(typeof navigator !== "undefined" && !navigator.onLine ? "local" : "saving");

      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }

      debouncedSaveRef.current = setTimeout(() => {
        debouncedSaveRef.current = null;
        void saveNow(nextValue, bufferUpdatedAt);
      }, 1500);
    },
    [saveNow]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
      valueRef.current = val;
      setValue(val);
      onValueChange?.(val);
      const bufferUpdatedAt = writeLocalBuffer(localStorageKeyRef.current, val);
      scheduleSave(val, bufferUpdatedAt);
  };

  const handleTranscript = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    const currentValue = valueRef.current;
    const nextValue = currentValue.trim() ? `${currentValue.trimEnd()}\n\n${cleanText}` : cleanText;
    const bufferUpdatedAt = writeLocalBuffer(localStorageKeyRef.current, nextValue);
    valueRef.current = nextValue;
    dirtyRef.current = true;
    setSaveStatus("saving");
    setValue(nextValue);
    onValueChange?.(nextValue);

    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
      debouncedSaveRef.current = null;
    }

    await saveNow(nextValue, bufferUpdatedAt);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.selectionStart = nextValue.length;
      textarea.selectionEnd = nextValue.length;
      adjustHeight();
    });
  };

  // Clean up timer on unmount
  useEffect(() => {
    const syncLocalBuffer = () => {
      const buffer = readLocalBuffer(localStorageKeyRef.current);
      if (!buffer) return;
      setSaveStatus("saving");
      void saveNow(buffer.content, buffer.updatedAt);
    };

    const markLocal = () => {
      if (readLocalBuffer(localStorageKeyRef.current)) setSaveStatus("local");
    };

    window.addEventListener("online", syncLocalBuffer);
    window.addEventListener("offline", markLocal);

    return () => {
      window.removeEventListener("online", syncLocalBuffer);
      window.removeEventListener("offline", markLocal);
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [readLocalBuffer, saveNow]);

  return (
    <div className="w-full font-body">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          if (!dirtyRef.current) return;
          if (debouncedSaveRef.current) {
            clearTimeout(debouncedSaveRef.current);
            debouncedSaveRef.current = null;
          }
          void saveNow(valueRef.current);
        }}
        placeholder={placeholder}
        rows={1}
        className="w-full bg-transparent border-0 outline-none resize-none text-text-primary text-base placeholder-text-muted focus:ring-0 p-0 font-body leading-relaxed"
      />
      <AttachmentToolbar
        sessionId={sessionId}
        checkpointId={checkpointId}
        attachments={attachments}
        onAttachmentAdded={onAttachmentAdded}
        onAttachmentDeleted={onAttachmentDeleted}
        onTranscript={handleTranscript}
        saveStatusSlot={
          <SaveStatusIndicator
            error={saveError}
            status={saveStatus}
            showSaved={showSavedStatus}
          />
        }
      />
    </div>
  );
}

interface SaveStatusIndicatorProps {
  error: string;
  status: "saved" | "saving" | "local";
  showSaved: boolean;
}

function SaveStatusIndicator({ error, status, showSaved }: SaveStatusIndicatorProps) {
  const label = error || (status === "saving" ? "Saving..." : status === "local" ? "Saved locally" : "Saved ✓");
  const isVisible = Boolean(error) || status === "saving" || status === "local" || showSaved;
  const tone = error ? "text-error" : status === "local" ? "text-accent" : status === "saved" ? "text-success" : "text-text-muted";

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`whitespace-nowrap text-xs ${tone}`}
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
