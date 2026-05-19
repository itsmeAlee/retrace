"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../Icon";
import { addAttachment, type CaptureItem, type CaptureType } from "../../lib/sessions";
import { uploadFile } from "../../lib/storage";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";

interface AttachmentToolbarProps {
  sessionId: string;
  checkpointId: string | null;
  onAttachmentAdded: (item: CaptureItem) => void;
  onAttachmentDeleted?: (id: string) => void;
  attachments?: CaptureItem[];
  actionSlot?: React.ReactNode;
  onTranscript?: (text: string) => Promise<void> | void;
}

export function AttachmentToolbar({
  sessionId,
  checkpointId,
  onAttachmentAdded,
  onAttachmentDeleted,
  attachments = [],
  actionSlot,
  onTranscript
}: AttachmentToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [waitingForAudio, setWaitingForAudio] = useState(false);
  const processedBlobRef = useRef<Blob | null>(null);

  const recorder = useVoiceRecorder();
  const { amplitudes, audioBlob, audioDuration, reset, startRecording, state: recorderState, stopRecording } = recorder;

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enforce 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      triggerToast("Files must be 5MB or smaller.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingFile(true);
    setUploadProgress(0);

    try {
      const uploaded = await uploadFile(file, sessionId, setUploadProgress);
      const isImg = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const captureType: CaptureType = isImg ? "image" : isPdf ? "pdf" : "file";

      const created = await addAttachment(sessionId, checkpointId, captureType, {
        content: file.name,
        sourceTitle: file.name,
        fileName: file.name,
        fileId: uploaded.fileId,
        fileMimeType: file.type,
        fileSize: file.size
      });

      onAttachmentAdded(created);
      triggerToast("File uploaded successfully.");
    } catch (err: any) {
      triggerToast(err?.message || "Failed to upload file.");
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlValue.trim()) return;

    let targetUrl = urlValue.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    setIsFetchingUrl(true);
    try {
      const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();
      const title = data.title || new URL(targetUrl).hostname;

      const created = await addAttachment(sessionId, checkpointId, "url", {
        content: targetUrl,
        sourceUrl: targetUrl,
        sourceTitle: title
      });

      onAttachmentAdded(created);
      setUrlValue("");
      setIsUrlInputOpen(false);
      triggerToast("Link attached successfully.");
    } catch (err: any) {
      // Fallback
      try {
        const title = new URL(targetUrl).hostname;
        const created = await addAttachment(sessionId, checkpointId, "url", {
          content: targetUrl,
          sourceUrl: targetUrl,
          sourceTitle: title
        });
        onAttachmentAdded(created);
        setUrlValue("");
        setIsUrlInputOpen(false);
        triggerToast("Link attached using hostname.");
      } catch {
        triggerToast("Invalid URL.");
      }
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const startVoiceDictation = async () => {
    try {
      processedBlobRef.current = null;
      setWaitingForAudio(false);
      await startRecording();
    } catch (err: any) {
      triggerToast(err.message || "Could not access microphone.");
    }
  };

  const stopVoiceDictation = () => {
    setWaitingForAudio(true);
    stopRecording();
  };

  useEffect(() => {
    if (!waitingForAudio) return;
    const timeout = window.setTimeout(() => {
      setWaitingForAudio(false);
      triggerToast("No audio was captured. Try again.");
      reset();
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [reset, triggerToast, waitingForAudio]);

  useEffect(() => {
    if (!waitingForAudio || recorderState !== "stopped" || !audioBlob || processedBlobRef.current === audioBlob) return;

    processedBlobRef.current = audioBlob;
    setWaitingForAudio(false);
    setIsTranscribing(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);

    async function transcribeAndAttach() {
      try {
        if (!audioBlob) throw new Error("No audio was captured. Try again.");

        const formData = new FormData();
        formData.append("audio", new File([audioBlob], "dictation.webm", { type: audioBlob.type || "audio/webm" }));

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
          signal: controller.signal
        });

        const data = (await res.json().catch(() => null)) as { duration?: number; error?: string; text?: string } | null;
        if (!res.ok) throw new Error(data?.error || "Failed to transcribe voice dictation.");

        const text = data?.text?.trim();
        if (!text) throw new Error("No speech detected. Try again.");

        if (onTranscript) {
          await onTranscript(text);
          triggerToast("Voice added to document.");
        } else {
          const created = await addAttachment(sessionId, checkpointId, "audio", {
            content: text,
            duration: data?.duration || audioDuration
          });
          onAttachmentAdded(created);
          triggerToast("Voice transcribed.");
        }
      } catch (err: any) {
        triggerToast(err?.name === "AbortError" ? "Transcription timed out. Try again." : err?.message || "Failed to transcribe voice dictation.");
      } finally {
        window.clearTimeout(timeout);
        setIsTranscribing(false);
        processedBlobRef.current = null;
        reset();
      }
    }

    void transcribeAndAttach();

    return () => window.clearTimeout(timeout);
  }, [audioBlob, audioDuration, checkpointId, onAttachmentAdded, onTranscript, recorderState, reset, sessionId, triggerToast, waitingForAudio]);

  return (
    <div className="mt-4 border-t border-border pt-3 font-body">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Actions Button Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* File Upload Trigger */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center h-8 w-8 rounded-full text-text-muted hover:bg-neutral-soft hover:text-text-primary transition-all"
            title="Attach a file"
            type="button"
          >
            <Icon name="upload" className="h-4 w-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt"
          />

          {/* Link Embed trigger */}
          <button
            onClick={() => setIsUrlInputOpen(!isUrlInputOpen)}
            className={`flex items-center justify-center h-8 w-8 rounded-full transition-all ${isUrlInputOpen ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-neutral-soft hover:text-text-primary"}`}
            title="Embed link"
            type="button"
          >
            <Icon name="link" className="h-4 w-4" />
          </button>

          {/* Voice Dictation trigger */}
          {recorderState === "recording" ? (
            <button
              onClick={stopVoiceDictation}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-error text-white hover:bg-error/95 transition-all shadow-sm"
              title="Stop Dictation"
              type="button"
            >
              <Icon name="stop" className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={startVoiceDictation}
              className="flex items-center justify-center h-8 w-8 rounded-full text-text-muted hover:bg-neutral-soft hover:text-text-primary transition-all"
              title="Voice Dictation"
              type="button"
              disabled={isTranscribing || waitingForAudio}
            >
              <Icon name="mic" className="h-4 w-4" />
            </button>
          )}

          {actionSlot}
        </div>

        {/* Dynamic Voice Recording / Progress State */}
        <div className="flex-1 flex justify-end">
          <AnimatePresence mode="wait">
            {recorderState === "recording" && (
              <motion.div
                key="recording"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 bg-error/5 border border-error/10 px-3 py-1 rounded-full h-8"
              >
                <div className="w-2 h-2 rounded-full bg-error animate-ping" />
                <span className="text-xs text-error font-medium">{audioDuration}s</span>
                <div className="flex items-center gap-[2px] h-4">
                  {amplitudes.slice(0, 12).map((amp, i) => (
                    <motion.div
                      key={i}
                      className="w-[2px] bg-error rounded-full"
                      animate={{ height: `${amp * 16}px` }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {(isTranscribing || waitingForAudio) && (
              <motion.div
                key="transcribing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs text-text-muted"
              >
                <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                {waitingForAudio ? "Preparing audio..." : "Transcribing voice dictation..."}
              </motion.div>
            )}

            {isUploadingFile && (
              <motion.div
                key="uploading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 bg-neutral-soft px-3 py-1 rounded-full h-8"
              >
                <div className="w-16 bg-border h-1 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="text-xs text-text-primary font-medium">{uploadProgress}%</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Inline Link input box */}
      <AnimatePresence>
        {isUrlInputOpen && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleUrlSubmit}
            className="overflow-hidden mt-3"
          >
            <div className="flex items-center gap-2 border border-border rounded-lg bg-surface px-3 py-1.5 focus-within:border-primary focus-within:shadow-focus transition-all">
              <Icon name="link" className="h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Paste URL and press Enter..."
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                className="flex-1 bg-transparent text-sm text-text-primary outline-none focus:ring-0 placeholder-text-muted"
                disabled={isFetchingUrl}
                autoFocus
              />
              {isFetchingUrl ? (
                <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              ) : (
                <button type="submit" className="text-xs text-primary font-semibold hover:text-primary-hover">
                  Attach
                </button>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Attachments Chip Arrays */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3.5">
          {attachments.map((item) => {
            const isImg = item.type === "image";
            const isLink = item.type === "url";
            const isAudio = item.type === "audio";
            
            let chipIcon: "image" | "link" | "mic" | "document" = "document";
            if (isImg) chipIcon = "image";
            else if (isLink) chipIcon = "link";
            else if (isAudio) chipIcon = "mic";

            return (
              <motion.div
                key={item.$id}
                layout
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="flex items-center gap-2 bg-white border border-border rounded-full py-1 pl-2.5 pr-2.5 text-xs text-text-primary font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)] max-w-xs group"
              >
                <Icon name={chipIcon} className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="truncate flex-1">
                  {isLink ? (item.sourceTitle || item.content) : item.content}
                </span>
                {onAttachmentDeleted && (
                  <button
                    onClick={() => onAttachmentDeleted(item.$id)}
                    className="text-text-muted hover:text-error transition-colors p-0.5"
                    type="button"
                  >
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating Toast Notification inside toolbar area */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
