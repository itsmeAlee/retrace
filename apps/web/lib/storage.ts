"use client";

import { Client, ID, Permission, Role, Storage, type Models } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID ?? "";

export type UploadedSessionFile = {
  fileId: string;
  userId: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
};

async function createAuthedStorage() {
  const response = await fetch("/api/auth/jwt", { method: "POST" });
  if (!response.ok) {
    throw new Error("Please sign in again.");
  }

  const data = (await response.json()) as { jwt?: string };
  if (!data.jwt || !endpoint || !projectId || !bucketId) {
    throw new Error("Storage is not configured.");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(data.jwt);
  return new Storage(client);
}

async function getCurrentUserId() {
  const response = await fetch("/api/auth/me", { method: "GET" });
  if (!response.ok) {
    throw new Error("Please sign in again.");
  }
  const data = (await response.json()) as { user?: Models.User<Models.Preferences> };
  if (!data.user?.$id) {
    throw new Error("Please sign in again.");
  }
  return data.user.$id;
}

export async function uploadFile(file: File, sessionId: string, onProgress?: (progress: number) => void): Promise<UploadedSessionFile> {
  const [storage, userId] = await Promise.all([createAuthedStorage(), getCurrentUserId()]);
  const created = await storage.createFile({
    bucketId,
    fileId: ID.unique(),
    file,
    permissions: [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))],
    onProgress: (progress) => onProgress?.(normalizeUploadProgress(progress))
  });

  return {
    fileId: created.$id,
    userId,
    name: created.name || file.name,
    size: created.sizeOriginal || file.size,
    mimeType: created.mimeType || file.type,
    url: getFileDownload(created.$id, sessionId)
  };
}

function normalizeUploadProgress(progress: { progress?: number; sizeUploaded?: number; sizeTotal?: number }) {
  if (typeof progress.progress === "number" && Number.isFinite(progress.progress)) {
    return Math.max(0, Math.min(100, Math.round(progress.progress)));
  }

  if (progress.sizeUploaded && progress.sizeTotal) {
    return Math.max(0, Math.min(100, Math.round((progress.sizeUploaded / progress.sizeTotal) * 100)));
  }

  return 0;
}

export function getFilePreview(fileId: string) {
  return `/api/files/${encodeURIComponent(bucketId)}/${encodeURIComponent(fileId)}?mode=preview`;
}

export function getFileView(fileId: string) {
  return `/api/files/${encodeURIComponent(bucketId)}/${encodeURIComponent(fileId)}?mode=view`;
}

export function getFileDownload(fileId: string, _sessionId?: string) {
  return `/api/files/${encodeURIComponent(bucketId)}/${encodeURIComponent(fileId)}?mode=download`;
}

export async function deleteFile(fileId: string) {
  const storage = await createAuthedStorage();
  await storage.deleteFile({ bucketId, fileId });
}
