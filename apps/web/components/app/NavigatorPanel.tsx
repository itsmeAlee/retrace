"use client";

import React from "react";
import { Icon } from "../Icon";
import { type CaptureItem } from "../../lib/sessions";

interface NavigatorPanelProps {
  checkpoints: CaptureItem[];
  sources: CaptureItem[];
  activeCheckpointId: string | null;
  activeView: "doc" | "checkpoint";
  onCheckpointSelect: (checkpointId: string, checkpointName: string) => void;
  onBack: () => void;
  onSourceClick?: (source: CaptureItem) => void;
}

export function NavigatorPanel({
  checkpoints,
  sources,
  activeCheckpointId,
  activeView,
  onCheckpointSelect,
  onBack,
  onSourceClick
}: NavigatorPanelProps) {
  return (
    <aside className="w-full h-full flex flex-col font-body text-sm select-none gap-6">
      <div className="flex flex-col gap-6">
        {/* Timeline Section */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-4 flex items-center gap-1.5">
            <Icon name="sessions" className="h-3.5 w-3.5" />
            <span>Checkpoint Timeline</span>
          </h4>
          
          <div className="relative pl-3 border-l-[1.5px] border-border ml-1.5 flex flex-col gap-4 py-1">
            <div
              onClick={onBack}
              className={`group relative -ml-[19px] flex cursor-pointer items-center gap-3 rounded-r-md py-1.5 pr-2 transition-all ${
                activeView === "doc"
                  ? "border-l-2 border-primary bg-bg pl-3 text-primary"
                  : "pl-[15px] text-text-muted hover:bg-neutral-soft/30 hover:text-text-primary"
              }`}
            >
              <div
                className={`mt-0 h-3 w-3 flex-shrink-0 rounded-full border-2 bg-bg transition-all ${
                  activeView === "doc" ? "border-primary bg-primary" : "border-border group-hover:border-text-muted"
                }`}
              />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className={`truncate text-sm ${activeView === "doc" ? "font-semibold text-primary" : ""}`}>
                  Session Notes
                </span>
                <span className="flex-shrink-0 text-[11px] text-text-muted">Current</span>
              </div>
            </div>

            {checkpoints.length === 0 ? (
              <p className="text-xs text-text-muted italic pl-4">No checkpoints created yet.</p>
            ) : (
              checkpoints.map((cp, index) => {
                const isActive = activeView === "checkpoint" && activeCheckpointId === cp.$id;
                const name = cp.checkpointName || "Untitled Checkpoint";
                return (
                  <div
                    key={cp.$id}
                    onClick={() => onCheckpointSelect(cp.$id, name)}
                    className={`group relative -ml-[19px] flex cursor-pointer items-center gap-3 rounded-r-md py-1.5 pr-2 transition-all ${
                      isActive 
                        ? "bg-bg border-l-2 border-primary pl-3 text-primary" 
                        : "pl-[15px] hover:bg-neutral-soft/30 text-text-muted hover:text-text-primary"
                    }`}
                  >
                    <div
                      className={`h-3 w-3 rounded-full border-2 bg-bg flex-shrink-0 transition-all ${
                        isActive
                          ? "border-primary bg-primary scale-110 shadow-sm"
                          : "border-border group-hover:border-text-muted"
                      }`}
                    />
                    
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span
                        className={`min-w-0 truncate text-sm transition-all ${
                          isActive ? "font-semibold text-primary" : ""
                        }`}
                      >
                        {index + 1}. {name}
                      </span>
                      <span className="flex-shrink-0 text-right text-[11px] text-text-muted">
                        {formatCheckpointTime(cp.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sources Section */}
        <div className="border-t border-border pt-5">
          <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-4 flex items-center gap-1.5">
            <Icon name="link" className="h-3.5 w-3.5" />
            <span>Session Sources</span>
          </h4>

          {sources.length === 0 ? (
            <p className="text-xs text-text-muted italic">No sources captured in this session.</p>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[30vh] overflow-y-auto pr-1">
              {sources.map((src) => {
                const isUrl = src.type === "url";
                const isImg = src.type === "image" || src.fileMimeType?.startsWith("image/");
                const isAudio = src.type === "audio";

                let srcIcon: "image" | "link" | "mic" | "document" = "document";
                if (isImg) srcIcon = "image";
                else if (isUrl) srcIcon = "link";
                else if (isAudio) srcIcon = "mic";

                return (
                  <div
                    key={src.$id}
                    onClick={() => {
                      if (onSourceClick) onSourceClick(src);
                      else if (isUrl) window.open(src.sourceUrl || src.content, "_blank");
                    }}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-neutral-soft cursor-pointer transition-all group"
                  >
                    <Icon name={srcIcon} className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate group-hover:text-primary transition-colors">
                        {isUrl ? (src.sourceTitle || src.content) : src.content}
                      </p>
                      <span className="text-[10px] text-text-muted font-mono uppercase tracking-tight">
                        {src.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function formatCheckpointTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
