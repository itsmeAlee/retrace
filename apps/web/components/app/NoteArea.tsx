"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AttachmentToolbar } from "./AttachmentToolbar";
import { InlineMediaList } from "./InlineMediaList";
import { uiDurations, uploadLimits } from "../../lib/app-constants";
import { logError } from "../../lib/debug";
import { addAttachment, type CaptureItem } from "../../lib/sessions";
import { deleteFile, uploadFile } from "../../lib/storage";

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
  onAttachmentDeleted?: (item: CaptureItem) => void;
  readOnly?: boolean;
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
  onAttachmentDeleted,
  readOnly = false
}: NoteAreaProps) {
  type SaveStatus = "saved" | "saving" | "local";
  type LocalNoteBuffer = {
    content: string;
    updatedAt: string;
  };

  const localStorageKey = checkpointId ? `retrace_note_checkpoint_${checkpointId}` : `retrace_note_session_${sessionId}`;
  const [value, setValue] = useState(initialValue);
  const [saveError, setSaveError] = useState("");
  const [mediaStatus, setMediaStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [showSavedStatus, setShowSavedStatus] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const afterTextareaRef = useRef<HTMLTextAreaElement>(null);
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeoutsRef = useRef<number[]>([]);
  const documentKey = checkpointId ?? `session:${sessionId}`;
  const documentKeyRef = useRef(documentKey);
  const localStorageKeyRef = useRef(localStorageKey);
  const mediaBoundaryKeyRef = useRef(`${localStorageKey}:media_boundary`);
  const valueRef = useRef(initialValue);
  const lastSavedValueRef = useRef(initialValue);
  const focusedRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveVersionRef = useRef(0);
  const onSaveRef = useRef(onSave);
  const [mediaBoundary, setMediaBoundary] = useState<number | null>(null);

  const clearFeedbackLater = useCallback((callback: () => void, delay: number) => {
    const timeout = window.setTimeout(() => {
      feedbackTimeoutsRef.current = feedbackTimeoutsRef.current.filter((item) => item !== timeout);
      callback();
    }, delay);
    feedbackTimeoutsRef.current.push(timeout);
  }, []);

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

  const readMediaBoundary = useCallback((key: string, content: string) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return null;
      return Math.max(0, Math.min(parsed, content.length));
    } catch {
      return null;
    }
  }, []);

  const writeMediaBoundary = useCallback((key: string, boundary: number) => {
    try {
      window.localStorage.setItem(key, String(boundary));
    } catch {
      // This only affects visual edit positioning; note content still saves normally.
    }
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
        logError("Failed to save note", err, { checkpointId, sessionId });
        if (saveVersion === saveVersionRef.current) {
          setSaveStatus("local");
          setSaveError("");
        }
      }
    },
    [checkpointId, clearLocalBuffer, readLocalBuffer, sessionId]
  );

  useEffect(() => {
    const remoteMs = timestampMs(initialUpdatedAt);
    const localBuffer = readLocalBuffer(localStorageKey);
    const hasNewerLocal = localBuffer ? timestampMs(localBuffer.updatedAt) > remoteMs : false;

    if (documentKeyRef.current !== documentKey) {
      documentKeyRef.current = documentKey;
      localStorageKeyRef.current = localStorageKey;
      mediaBoundaryKeyRef.current = `${localStorageKey}:media_boundary`;
      const nextValue = hasNewerLocal && localBuffer ? localBuffer.content : initialValue;
      valueRef.current = nextValue;
      lastSavedValueRef.current = initialValue;
      dirtyRef.current = hasNewerLocal;
      setValue(nextValue);
      onValueChange?.(nextValue);
      setSaveError("");
      setSaveStatus(hasNewerLocal ? "local" : "saved");
      setMediaBoundary(readMediaBoundary(`${localStorageKey}:media_boundary`, nextValue));
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
      setMediaBoundary(readMediaBoundary(localStorageKeyRef.current + ":media_boundary", localBuffer.content));
      void saveNow(localBuffer.content, localBuffer.updatedAt);
      return;
    }

    if (!focusedRef.current && !dirtyRef.current && initialValue !== lastSavedValueRef.current) {
      valueRef.current = initialValue;
      lastSavedValueRef.current = initialValue;
      setValue(initialValue);
      onValueChange?.(initialValue);
      setSaveStatus("saved");
      setMediaBoundary(readMediaBoundary(localStorageKeyRef.current + ":media_boundary", initialValue));
      if (localBuffer && !hasNewerLocal) {
        clearLocalBuffer(localStorageKey);
      }
    }
  }, [clearLocalBuffer, documentKey, initialUpdatedAt, initialValue, localStorageKey, onValueChange, readLocalBuffer, readMediaBoundary, saveNow, timestampMs]);

  // Adjust height on text value change
  const adjustHeight = useCallback(() => {
    [textareaRef.current, afterTextareaRef.current].forEach((textarea) => {
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
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
    const timeout = window.setTimeout(() => setShowSavedStatus(false), uiDurations.savedStatusMs);
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
      }, uiDurations.noteAutosaveMs);
    },
    [saveNow]
  );

  const applyValueChange = (val: string) => {
    if (readOnly) return;
    valueRef.current = val;
    setValue(val);
    onValueChange?.(val);
    const bufferUpdatedAt = writeLocalBuffer(localStorageKeyRef.current, val);
    scheduleSave(val, bufferUpdatedAt);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyValueChange(e.target.value);
  };

  const splitBoundary = attachments.length > 0 ? mediaBoundary ?? value.length : null;
  const beforeMediaText = splitBoundary === null ? value : value.slice(0, splitBoundary);
  const afterMediaText = splitBoundary === null ? "" : value.slice(splitBoundary).replace(/^\n+/, "");

  const updateSplitText = (nextBefore: string, nextAfter: string) => {
    const normalizedAfter = nextAfter.replace(/^\n+/, "");
    const nextBoundary = nextBefore.length;
    const nextValue = normalizedAfter ? `${nextBefore}${nextBefore ? "\n\n" : ""}${normalizedAfter}` : nextBefore;
    setMediaBoundary(nextBoundary);
    writeMediaBoundary(mediaBoundaryKeyRef.current, nextBoundary);
    applyValueChange(nextValue);
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const files = Array.from(event.clipboardData.files);
    const image = files.find((file) => file.type.startsWith("image/"));
    if (!image) return;

    event.preventDefault();

    if (image.size > uploadLimits.pastedImageBytes) {
      setSaveError("Images must be 2MB or smaller.");
      clearFeedbackLater(() => setSaveError(""), uiDurations.toastMs);
      return;
    }

    setSaveError("");
    setMediaStatus("Uploading image...");
    let uploadedFileId = "";
    try {
      const uploaded = await uploadFile(image, sessionId, (progress) => setMediaStatus(`Uploading image ${progress}%...`));
      uploadedFileId = uploaded.fileId;
      setMediaStatus("Saving image...");
      const created = await addAttachment(sessionId, checkpointId, "image", {
        content: image.name || "Pasted image",
        sourceTitle: image.name || "Pasted image",
        fileName: image.name || "pasted-image.png",
        fileId: uploaded.fileId,
        fileMimeType: image.type,
        fileSize: image.size,
        userId: uploaded.userId
      });
      handleAttachmentAdded(created);
      setMediaStatus("Image added.");
      clearFeedbackLater(() => setMediaStatus(""), uiDurations.savedStatusMs);
    } catch (err: any) {
      if (uploadedFileId) {
        void deleteFile(uploadedFileId).catch(() => {});
      }
      setMediaStatus("");
      setSaveError(err?.message || "Could not add pasted image.");
      clearFeedbackLater(() => setSaveError(""), uiDurations.toastMs);
    }
  };

  const handleTranscript = async (text: string) => {
    if (readOnly) return;
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
      const textarea = afterTextareaRef.current || textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;
      adjustHeight();
    });
  };

  const handleAttachmentAdded = (item: CaptureItem) => {
    if (readOnly) return;
    onAttachmentAdded(item);
    if (mediaBoundary === null) {
      const boundary = valueRef.current.length;
      setMediaBoundary(boundary);
      writeMediaBoundary(mediaBoundaryKeyRef.current, boundary);
    }
    requestAnimationFrame(() => {
      const textarea = afterTextareaRef.current || textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.selectionStart = textarea.value.length;
      textarea.selectionEnd = textarea.value.length;
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
      feedbackTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      feedbackTimeoutsRef.current = [];
    };
  }, [readLocalBuffer, saveNow]);

  return (
    <div className="w-full font-body">
      {attachments.length > 0 ? (
        <>
          <textarea
            ref={textareaRef}
            value={beforeMediaText}
            onChange={(event) => updateSplitText(event.target.value, afterMediaText)}
            onPaste={handlePaste}
            readOnly={readOnly}
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
            className={`w-full bg-transparent border-0 outline-none resize-none text-text-primary text-base placeholder-text-muted focus:ring-0 p-0 font-body leading-relaxed ${readOnly ? "cursor-default" : ""}`}
          />
          <InlineMediaList attachments={attachments} onDelete={readOnly ? undefined : onAttachmentDeleted} />
          <textarea
            ref={afterTextareaRef}
            value={afterMediaText}
            onChange={(event) => updateSplitText(beforeMediaText, event.target.value)}
            onPaste={handlePaste}
            readOnly={readOnly}
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
            placeholder="Continue writing..."
            rows={1}
            className={`mt-3 w-full bg-transparent border-0 outline-none resize-none text-text-primary text-base placeholder-text-muted focus:ring-0 p-0 font-body leading-relaxed ${readOnly ? "cursor-default" : ""}`}
          />
        </>
      ) : (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        readOnly={readOnly}
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
        className={`w-full bg-transparent border-0 outline-none resize-none text-text-primary text-base placeholder-text-muted focus:ring-0 p-0 font-body leading-relaxed ${readOnly ? "cursor-default" : ""}`}
      />
      )}
      {!readOnly && (
        <AttachmentToolbar
          sessionId={sessionId}
          checkpointId={checkpointId}
          onAttachmentAdded={handleAttachmentAdded}
          onTranscript={handleTranscript}
          saveStatusSlot={
            <SaveStatusIndicator
              error={saveError}
              mediaStatus={mediaStatus}
              status={saveStatus}
              showSaved={showSavedStatus}
            />
          }
        />
      )}
    </div>
  );
}

interface SaveStatusIndicatorProps {
  error: string;
  mediaStatus: string;
  status: "saved" | "saving" | "local";
  showSaved: boolean;
}

function SaveStatusIndicator({ error, mediaStatus, status, showSaved }: SaveStatusIndicatorProps) {
  const label = mediaStatus || error || (status === "saving" ? "Saving..." : status === "local" ? "Saved locally" : "Saved ✓");
  const isVisible = Boolean(mediaStatus) || Boolean(error) || status === "saving" || status === "local" || showSaved;
  const tone = error ? "text-error" : mediaStatus ? "text-text-muted" : status === "local" ? "text-accent" : status === "saved" ? "text-success" : "text-text-muted";

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
