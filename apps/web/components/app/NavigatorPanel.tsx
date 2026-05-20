"use client";

import React from "react";
import { Icon } from "../Icon";
import { type CaptureItem } from "../../lib/sessions";

interface NavigatorPanelProps {
  checkpoints: CaptureItem[];
  sources: CaptureItem[];
  activeId: string | null;
  onCheckpointClick: (checkpointId: string) => void;
  onSourceClick?: (source: CaptureItem) => void;
}

export function NavigatorPanel({
  checkpoints,
  sources,
  activeId,
  onCheckpointClick,
  onSourceClick
}: NavigatorPanelProps) {
  return (
    <aside className="w-full flex flex-col gap-6 font-body text-sm select-none">
      {/* Timeline Section */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-4 flex items-center gap-1.5">
          <Icon name="sessions" className="h-3.5 w-3.5" />
          <span>Checkpoint Timeline</span>
        </h4>
        
        {checkpoints.length === 0 ? (
          <p className="text-xs text-text-muted italic pl-1">No checkpoints created yet.</p>
        ) : (
          <div className="relative pl-3 border-l-[1.5px] border-border ml-1.5 flex flex-col gap-4 py-1">
            {checkpoints.map((cp, index) => {
              const isActive = activeId === cp.$id;
              return (
                <div
                  key={cp.$id}
                  onClick={() => onCheckpointClick(cp.$id)}
                  className="group relative flex items-start gap-3 cursor-pointer -ml-[19px] transition-all"
                >
                  {/* Timeline Bullet Node */}
                  <div
                    className={`h-3 w-3 rounded-full border-2 bg-bg flex-shrink-0 transition-all mt-1 ${
                      isActive
                        ? "border-accent bg-accent scale-110 shadow-sm"
                        : "border-border group-hover:border-text-muted"
                    }`}
                  />
                  
                  {/* Text node */}
                  <span
                    className={`transition-all truncate flex-1 text-sm ${
                      isActive
                        ? "text-accent font-semibold"
                        : "text-text-muted group-hover:text-text-primary"
                    }`}
                  >
                    {index + 1}. {cp.checkpointName || "Untitled Checkpoint"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
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
          <div className="flex flex-col gap-2.5">
            {sources.map((src) => {
              const isUrl = src.type === "url";
              const isImg = src.type === "image";
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
                    else if (isUrl && src.sourceUrl) window.open(src.sourceUrl, "_blank");
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
    </aside>
  );
}
