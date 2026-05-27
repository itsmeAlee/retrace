"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Icon } from "../Icon";
import { type CaptureItem } from "../../lib/sessions";
import { getFileDownload, getFileView } from "../../lib/storage";

type InlineMediaBlockProps = {
  item: CaptureItem;
  onDelete?: (item: CaptureItem) => void;
};

type YouTubeEmbed = {
  embedUrl: string;
  thumbnailUrl: string;
  videoId: string;
};

export function getYouTubeEmbed(url?: string): YouTubeEmbed | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/").filter(Boolean)[1] || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/").filter(Boolean)[1] || "";
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
    }

    if (!/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return null;

    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      videoId
    };
  } catch {
    return null;
  }
}

export function InlineMediaBlock({ item, onDelete }: InlineMediaBlockProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const sourceUrl = item.sourceUrl || item.content;
  const youtube = useMemo(() => getYouTubeEmbed(sourceUrl), [sourceUrl]);
  const isImageFile = Boolean(item.fileId && (item.type === "image" || item.fileMimeType?.startsWith("image/")));

  if (isImageFile && item.fileId) {
    return (
      <MediaFrame onDelete={onDelete ? () => onDelete(item) : undefined}>
        <button
          className="block w-full rounded-note bg-neutral-soft p-2 text-left"
          onClick={() => window.open(getFileDownload(item.fileId || ""), "_blank")}
          type="button"
        >
          <Image
            alt={item.fileName || item.sourceTitle || item.content || "Attached image"}
            className="max-h-96 w-full rounded-note object-contain"
            height={384}
            loading="lazy"
            src={getFileView(item.fileId)}
            unoptimized
            width={768}
          />
        </button>
        <MediaCaption icon="image" label={item.fileName || item.content || "Image"} />
      </MediaFrame>
    );
  }

  if (youtube) {
    return (
      <MediaFrame onDelete={onDelete ? () => onDelete(item) : undefined}>
        <div className="aspect-video overflow-hidden rounded-note bg-neutral-soft">
          {isPlaying ? (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
              loading="lazy"
              src={`${youtube.embedUrl}?autoplay=1&rel=0`}
              title={item.sourceTitle || "YouTube video"}
            />
          ) : (
            <button
              className="group relative h-full w-full overflow-hidden"
              onClick={() => setIsPlaying(true)}
              type="button"
            >
              <Image
                alt=""
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                height={360}
                loading="lazy"
                src={youtube.thumbnailUrl}
                unoptimized
                width={640}
              />
              <span className="absolute inset-0 bg-text-primary/20" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-icon-lg w-icon-lg items-center justify-center rounded-full bg-primary text-white shadow-card">
                  <Icon name="play" className="h-5 w-5 fill-current" />
                </span>
              </span>
            </button>
          )}
        </div>
        <MediaCaption icon="video" label={item.sourceTitle || sourceUrl || "YouTube video"} />
      </MediaFrame>
    );
  }

  if (item.fileId) {
    const fileUrl = getFileDownload(item.fileId);
    return (
      <MediaFrame onDelete={onDelete ? () => onDelete(item) : undefined}>
        <div className="flex items-center justify-between gap-4 rounded-note bg-neutral-soft p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-icon-md w-icon-md flex-shrink-0 items-center justify-center rounded-note bg-surface text-primary">
              <Icon name="document" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{item.fileName || item.content || "Attached file"}</p>
              <p className="text-xs text-text-muted">{formatFileSize(item.fileSize)}</p>
            </div>
          </div>
          <a
            className="flex-shrink-0 text-xs font-semibold text-primary hover:text-primary-hover"
            href={fileUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open
          </a>
        </div>
      </MediaFrame>
    );
  }

  return (
    <MediaFrame onDelete={onDelete ? () => onDelete(item) : undefined}>
      <a
        className="flex items-start gap-3 rounded-note bg-neutral-soft p-4 transition-colors hover:bg-surface-hover"
        href={sourceUrl}
        rel="noreferrer"
        target="_blank"
      >
        <span className="mt-0.5 flex h-icon-md w-icon-md flex-shrink-0 items-center justify-center rounded-note bg-surface text-primary">
          <Icon name="link" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-text-primary">{item.sourceTitle || item.content || "Attached link"}</span>
          <span className="block truncate text-xs text-text-muted">{sourceUrl}</span>
        </span>
      </a>
    </MediaFrame>
  );
}

function MediaFrame({ children, onDelete }: { children: React.ReactNode; onDelete?: () => void }) {
  return (
    <div className="group/media relative rounded-card border border-border bg-surface p-2 shadow-card">
      {children}
      {onDelete && (
        <button
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-text-muted opacity-0 shadow-card transition-all hover:text-error group-hover/media:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
          type="button"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function MediaCaption({ icon, label }: { icon: "image" | "video"; label: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 px-1 text-xs text-text-muted">
      <Icon name={icon} className="h-3.5 w-3.5 text-primary" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function formatFileSize(size?: number) {
  if (!size) return "File";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
