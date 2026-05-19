"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { addCapture, type CaptureItem, type CaptureType } from "../../lib/sessions";
import { uploadFile } from "../../lib/storage";
import { Icon } from "../Icon";

const accept = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt";

type FileUploadProps = {
  sessionId: string;
  onCreated: (tempCapture: CaptureItem, createRequest: Promise<CaptureItem>) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function detectFileType(file: File): CaptureType {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return "file";
}

export function FileUpload({ sessionId, onCreated, onError, onSuccess }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  function pickFile(nextFile?: File) {
    if (!nextFile) return;
    if (nextFile.size > 20 * 1024 * 1024) {
      onError("Files must be 20MB or smaller.");
      return;
    }
    setFile(nextFile);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    pickFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  async function submit() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const uploaded = await uploadFile(file, sessionId, setProgress);
      const type = detectFileType(file);
      const createdAt = new Date().toISOString();
      const tempCapture: CaptureItem = {
        $id: `temp-file-${createdAt}`,
        sessionId,
        userId: "",
        type,
        content: file.name,
        sourceTitle: file.name,
        note: note.trim() || undefined,
        fileId: uploaded.fileId,
        fileName: uploaded.name,
        fileSize: uploaded.size,
        fileMimeType: uploaded.mimeType,
        createdAt
      };
      const createRequest = addCapture({
        sessionId,
        type,
        content: file.name,
        sourceTitle: file.name,
        note: note.trim() || undefined,
        fileId: uploaded.fileId,
        fileName: uploaded.name,
        fileSize: uploaded.size,
        fileMimeType: uploaded.mimeType
      }).finally(() => setUploading(false));
      onCreated(tempCapture, createRequest);
      setFile(null);
      setNote("");
      setNoteOpen(false);
      onSuccess("File added.");
    } catch (err) {
      setUploading(false);
      onError(err instanceof Error ? err.message : "Could not upload file.");
    }
  }

  if (uploading) {
    return (
      <div className="rounded-form border border-border bg-surface p-4">
        <div className="h-1 rounded-pill bg-border">
          <motion.div animate={{ width: `${progress}%` }} className="h-1 rounded-pill bg-primary transition-all" />
        </div>
        <p className="mt-2 text-center text-xs text-text-muted">Uploading... {progress}%</p>
      </div>
    );
  }

  if (file) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-form border border-border bg-surface p-3">
          <Icon className="h-5 w-5 text-primary" name={detectFileType(file) === "image" ? "image" : "file"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-primary">{file.name}</p>
            <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
          </div>
          <button className="text-xs text-error" onClick={() => setFile(null)} type="button">
            Remove
          </button>
        </div>

        <button className="mt-3 text-sm font-medium text-primary" onClick={() => setNoteOpen((open) => !open)} type="button">
          + Add a note
        </button>
        <AnimatePresence initial={false}>
          {noteOpen ? (
            <motion.textarea
              animate={{ height: "auto", opacity: 1 }}
              className="mt-3 min-h-16 w-full resize-none rounded-form border-[1.5px] border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary focus:shadow-focus"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add a note (optional)"
              value={note}
            />
          ) : null}
        </AnimatePresence>
        <button className="mt-4 h-11 w-full rounded-pill bg-primary text-base font-medium text-white" onClick={submit} type="button">
          Add to session
        </button>
      </div>
    );
  }

  return (
    <div
      className={`cursor-pointer rounded-form border-[1.5px] border-dashed p-6 text-center transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border bg-bg"}`}
      onClick={() => inputRef.current?.click()}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
    >
      <input accept={accept} className="hidden" onChange={handleInput} ref={inputRef} type="file" />
      <Icon className="mx-auto h-6 w-6 text-text-muted" name="upload" />
      <p className="mt-2 text-sm font-medium text-text-primary">Drop a file or click to browse</p>
      <p className="mt-1 text-xs text-text-muted">PDF, image, or document, up to 20MB</p>
    </div>
  );
}
