"use client";

import { Client, ID, Permission, Role, Storage, type Models } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID ?? "";

export type UploadedSessionFile = {
  fileId: string;
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
  const storage = await createAuthedStorage();
  const userId = await getCurrentUserId();
  const created = await storage.createFile({
    bucketId,
    fileId: ID.unique(),
    file,
    permissions: [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))],
    onProgress: (progress) => onProgress?.(Math.round(progress.progress))
  });

  return {
    fileId: created.$id,
    name: created.name || file.name,
    size: created.sizeOriginal || file.size,
    mimeType: created.mimeType || file.type,
    url: getFileDownload(created.$id, sessionId)
  };
}

export function getFilePreview(fileId: string) {
  return `/api/files/${encodeURIComponent(bucketId)}/${encodeURIComponent(fileId)}?mode=preview`;
}

export function getFileDownload(fileId: string, _sessionId?: string) {
  return `/api/files/${encodeURIComponent(bucketId)}/${encodeURIComponent(fileId)}?mode=download`;
}

export async function deleteFile(fileId: string) {
  const storage = await createAuthedStorage();
  await storage.deleteFile({ bucketId, fileId });
}
