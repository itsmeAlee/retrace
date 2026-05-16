export type CaptureType = "text" | "url" | "video" | "note" | "audio";

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface CaptureItem {
  id: string;
  sessionId: string;
  type: CaptureType;
  content: string;
  sourceUrl: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}
