"use client";

import { addCapture, listCaptures } from "./sessions";

export async function dropAutoMarker(sessionId: string) {
  const { captures } = await listCaptures(sessionId, undefined, 100);
  const sorted = [...captures].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const last = sorted[sorted.length - 1];
  if (!last || last.isMarker) return null;

  const lastMarkerIndex = [...sorted].reverse().findIndex((capture) => capture.isMarker);
  const capturesSinceLastMarker = lastMarkerIndex === -1 ? sorted.length : lastMarkerIndex;
  if (capturesSinceLastMarker < 1) return null;

  return addCapture({
    sessionId,
    type: "text",
    content: "Session paused",
    isMarker: true,
    isAutoMarker: true
  });
}
