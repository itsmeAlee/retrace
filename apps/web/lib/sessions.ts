"use client";

import { ExecutionMethod, Databases, Query, ID, Client } from "appwrite";
import type { CheckpointAIData, DiagramOutput, SourceReference } from "../types/checkpoint";
import { appwritePublicConfig } from "./app-config";
import { getCurrentUserId as getCachedCurrentUserId, getSessionJwt } from "./auth-client";
import { logError } from "./debug";

export type SessionStatus = "active" | "paused" | "completed" | "archived";
export type CaptureType = "text" | "url" | "video" | "pdf" | "image" | "file" | "audio";

export type RetraceSession = {
  $id: string;
  userId: string;
  name: string;
  description?: string;
  status: SessionStatus;
  captureCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CaptureItem = {
  $id: string;
  $updatedAt?: string;
  sessionId: string;
  userId: string;
  type: CaptureType;
  content: string;
  sourceUrl?: string;
  sourceTitle?: string;
  note?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  markerNote?: string;
  isMarker?: boolean;
  createdAt: string;
  duration?: number;
  
  // New columns
  isCheckpoint?: boolean;
  checkpointName?: string;
  checkpointId?: string;
  noteContent?: string;
  isSessionNote?: boolean;
  aiTitle?: string;
  aiStatus?: "pending" | "processing" | "complete" | "failed";
  aiContext?: string;
  aiKeyPoints?: string[] | string;
  aiSourcesUsed?: SourceReference[] | string;
  aiDiagrams?: DiagramOutput[] | string;
  aiProcessedAt?: string | null;
  aiError?: string;
};

export type CaptureDetails = {
  fullContent?: string;
  markerNote?: string;
  updatedAt?: string;
  
  // AI fields
  aiTitle?: string;
  aiStatus?: "pending" | "complete" | "processing" | "failed";
  aiContext?: string;
  aiKeyPoints?: string[];
  aiSourcesUsed?: SourceReference[];
  aiKeyFindings?: string[];
  aiTensions?: string[];
  aiGaps?: string[];
  aiSuggestedNext?: string;
  aiDiagrams?: DiagramOutput[];
  aiCaptureCount?: number;
  aiProcessedAt?: string;
  aiErrors?: string[];
  aiError?: string;
};

export type CheckpointWithAI = Omit<CaptureItem, keyof CheckpointAIData> & CheckpointAIData;

export type AddCaptureInput = {
  sessionId: string;
  type: CaptureType;
  content: string;
  sourceUrl?: string;
  sourceTitle?: string;
  note?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  markerNote?: string | null;
  isMarker?: boolean;
};

export type UpdateCaptureInput = Partial<
  Pick<CaptureItem, "content" | "sourceUrl" | "sourceTitle" | "note" | "markerNote" | "checkpointName">
>;

type FunctionResult<T> =
  | ({ success: true } & T)
  | {
      success: false;
      error?: string;
      message?: string;
    };

export class SessionsUiError extends Error {
  code?: string;
  cause?: unknown;

  constructor(message: string, code?: string, cause?: unknown) {
    super(message);
    this.name = "SessionsUiError";
    this.code = code;
    this.cause = cause;
  }
}

const endpoint = appwritePublicConfig.endpoint;
const projectId = appwritePublicConfig.projectId;
const dbId = appwritePublicConfig.databaseId;
const capturesTableId = appwritePublicConfig.captureItemsTableId;
const sessionNoteMarker = "__retrace_session_note";
const checkpointPollIntervalMs = 4000;
const checkpointPollTimeoutMs = 90000;
const checkpointPollRequestTimeoutMs = 6000;

const functionEndpoints = {
  create: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_CREATE ?? `${endpoint}/functions/sessions-create/executions`,
  list: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_LIST ?? `${endpoint}/functions/sessions-list/executions`,
  get: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_GET ?? `${endpoint}/functions/sessions-get/executions`,
  update: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_UPDATE ?? `${endpoint}/functions/sessions-update/executions`,
  delete: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_DELETE ?? `${endpoint}/functions/sessions-delete/executions`,
  addCapture: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_CAPTURES_ADD ?? `${endpoint}/functions/captures-add/executions`,
  listCaptures: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_CAPTURES_LIST ?? `${endpoint}/functions/captures-list/executions`,
  updateCapture: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_CAPTURES_UPDATE ?? `${endpoint}/functions/captures-update/executions`,
  getCaptureDetails: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_CAPTURES_GET_DETAILS ?? `${endpoint}/functions/captures-get-details/executions`
};

function functionIdFromEndpoint(functionEndpoint: string) {
  const match = functionEndpoint.match(/\/functions\/([^/]+)\/executions\/?$/);
  return match ? decodeURIComponent(match[1]) : functionEndpoint;
}

function mapMessage(code?: string, message?: string) {
  switch (code) {
    case "UNAUTHORIZED":
    case "401":
      return "Please sign in again.";
    case "FORBIDDEN":
    case "403":
      return "You do not have access to this session.";
    case "NOT_FOUND":
    case "404":
    case "document_not_found":
      return "This session could not be found.";
    case "CONFLICT":
    case "409":
    case "document_already_exists":
      return message ?? "This changed somewhere else. Refresh and try again.";
    case "500":
    case "FUNCTION_EXECUTION_FAILED":
    case "general_server_error":
      return message ?? "The sessions service is unavailable. Please try again.";
    case "VALIDATION_ERROR":
      return message ?? "Please check the form and try again.";
    case "METHOD_NOT_ALLOWED":
      return "This action is not available right now.";
    default:
      return message ?? "Something went wrong. Please try again.";
  }
}

function appwriteErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {};
  }

  const value = error as { code?: unknown; type?: unknown; message?: unknown; response?: unknown };
  return {
    code: typeof value.code === "string" || typeof value.code === "number" ? String(value.code) : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
    response: value.response
  };
}

function normalizeSessionsError(error: unknown, fallbackMessage = "Something went wrong. Please try again.") {
  if (error instanceof SessionsUiError) {
    if (error.message === "Failed to fetch") {
      return new SessionsUiError("Could not connect to the sessions service. Please try again.", "NETWORK_ERROR", error);
    }
    return error;
  }

  const details = appwriteErrorDetails(error);
  if (details.message === "Failed to fetch" || error instanceof TypeError) {
    return new SessionsUiError("Could not connect to the sessions service. Please try again.", "NETWORK_ERROR", error);
  }

  if (details.code || details.type || details.message) {
    return new SessionsUiError(mapMessage(details.type ?? details.code, details.message ?? fallbackMessage), details.type ?? details.code, error);
  }

  return new SessionsUiError(fallbackMessage, undefined, error);
}

async function executeFunction<T>(
  functionEndpoint: string,
  method: ExecutionMethod,
  options: { body?: Record<string, unknown>; query?: Record<string, string | number | undefined> } = {}
) {
  let response: Response;
  try {
    response = await fetch("/api/appwrite/functions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        functionId: functionIdFromEndpoint(functionEndpoint),
        method,
        body: options.body,
        query: options.query
      })
    });
  } catch (error) {
    throw normalizeSessionsError(error, "Could not connect to the sessions service. Please try again.");
  }

  const parsed = (await response.json().catch(() => null)) as FunctionResult<T> | null;

  if (!response.ok || !parsed) {
    const errorPayload = parsed && !parsed.success ? parsed : null;
    throw new SessionsUiError(
      errorPayload?.message ?? (response.status === 401 ? "Please sign in again." : "The sessions service did not respond."),
      errorPayload?.error ?? (response.status === 401 ? "UNAUTHORIZED" : undefined)
    );
  }

  if (!parsed.success) {
    throw new SessionsUiError(mapMessage(parsed.error, parsed.message), parsed.error);
  }

  return parsed;
}

async function createAuthedDatabases() {
  let jwt: string;
  try {
    jwt = await getSessionJwt();
  } catch (error) {
    throw new SessionsUiError("Please sign in again.", "UNAUTHORIZED");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
  return new Databases(client);
}

async function getCurrentUserId() {
  try {
    return await getCachedCurrentUserId();
  } catch {
    throw new SessionsUiError("Please sign in again.", "UNAUTHORIZED");
  }
}

function isSchemaMismatchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Attribute not found in schema") || message.includes("Invalid document structure");
}

async function getSessionNoteFallback(db: Databases, sessionId: string) {
  const res = await db.listDocuments(dbId, capturesTableId, [Query.equal("sessionId", sessionId), Query.limit(100)]);
  const note = (res.documents as unknown as CaptureItem[]).find((item) => item.isSessionNote || item.sourceTitle === sessionNoteMarker);
  return note ?? null;
}

export async function createSession(name: string, description?: string) {
  const result = await executeFunction<{ session: RetraceSession }>(functionEndpoints.create, ExecutionMethod.POST, {
    body: { name, description }
  });
  return result.session;
}

export async function listSessions(limit = 10, offset = 0) {
  const result = await executeFunction<{ sessions: RetraceSession[]; total: number }>(functionEndpoints.list, ExecutionMethod.GET, {
    query: { limit, offset }
  });
  return { sessions: result.sessions, total: result.total };
}

export async function getSession(sessionId: string) {
  try {
    const result = await executeFunction<{ session: RetraceSession }>(functionEndpoints.get, ExecutionMethod.GET, {
      query: { sessionId }
    });
    return result.session;
  } catch (error) {
    const normalized = normalizeSessionsError(error, "Could not load this session. Please try again.");
    logError("getSession failed", error, {
      sessionId,
      code: normalized.code,
      message: normalized.message
    });
    throw normalized;
  }
}

export async function updateSession(sessionId: string, fields: Partial<Pick<RetraceSession, "name" | "description" | "status">>) {
  const result = await executeFunction<{ session: RetraceSession }>(functionEndpoints.update, ExecutionMethod.PATCH, {
    body: { sessionId, ...fields }
  });
  return result.session;
}

export async function deleteSession(sessionId: string) {
  await executeFunction(functionEndpoints.delete, ExecutionMethod.DELETE, {
    body: { sessionId }
  });
}

export async function addCapture(input: AddCaptureInput) {
  const result = await executeFunction<{ capture: CaptureItem }>(functionEndpoints.addCapture, ExecutionMethod.POST, {
    body: input
  });
  return result.capture;
}

export async function updateCapture(captureId: string, fields: UpdateCaptureInput) {
  const result = await executeFunction<{ capture: CaptureItem; details?: CaptureDetails }>(functionEndpoints.updateCapture, ExecutionMethod.PATCH, {
    body: { captureId, ...fields }
  });
  return { capture: result.capture, details: result.details };
}

export async function listCaptures(sessionId: string, type?: CaptureType, limit = 20, offset = 0) {
  const result = await executeFunction<{ captures: CaptureItem[]; total: number }>(functionEndpoints.listCaptures, ExecutionMethod.GET, {
    query: { sessionId, type, limit, offset }
  });
  return { captures: result.captures, total: result.total };
}

export async function getCaptureDetails(captureId: string) {
  const result = await executeFunction<{ details: CaptureDetails }>(functionEndpoints.getCaptureDetails, ExecutionMethod.GET, {
    query: { captureId }
  });
  return result.details;
}

export async function getCheckpointWithAI(checkpointId: string): Promise<CheckpointWithAI> {
  const db = await createAuthedDatabases();
  const checkpoint = await db.getDocument(dbId, capturesTableId, checkpointId) as unknown as CaptureItem;
  const documentAi = normalizeCheckpointAI(checkpoint);
  const details = await getCaptureDetails(checkpointId).catch(() => null);
  const detailAi = details ? normalizeCheckpointAI(details) : null;
  const detailContent =
    typeof details?.fullContent === "string"
      ? details.fullContent
      : typeof (details as { noteContent?: unknown } | null)?.noteContent === "string"
        ? String((details as { noteContent?: unknown }).noteContent)
        : "";

  return {
    ...checkpoint,
    content: checkpoint.content || detailContent || "",
    noteContent: checkpoint.noteContent || detailContent || checkpoint.content || "",
    ...documentAi,
    ...(detailAi && hasCheckpointAi(detailAi) ? detailAi : {})
  };
}

export function pollCheckpointAiStatus(
  checkpointId: string,
  onComplete: (data: CheckpointAIData) => void,
  onFailed: (data?: CheckpointAIData) => void
): () => void {
  let stopped = false;
  let elapsedMs = 0;
  let timeoutId: number | undefined;

  const poll = async () => {
    if (stopped) return;
    try {
      const checkpoint = await withTimeout(getCheckpointWithAI(checkpointId), checkpointPollRequestTimeoutMs);
      if (checkpoint.aiStatus === "complete" && checkpoint.aiContext.trim()) {
        stopped = true;
        onComplete(checkpoint);
        return;
      }
      if (checkpoint.aiStatus === "failed") {
        stopped = true;
        onFailed(checkpoint);
        return;
      }
    } catch {
      // Keep polling until the timeout. Event-triggered functions can lag briefly.
    }

    elapsedMs += checkpointPollIntervalMs;
    if (elapsedMs >= checkpointPollTimeoutMs) {
      stopped = true;
      onFailed();
      return;
    }

    timeoutId = window.setTimeout(poll, checkpointPollIntervalMs);
  };

  void poll();

  return () => {
    stopped = true;
    if (timeoutId) window.clearTimeout(timeoutId);
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Checkpoint polling request timed out.")), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

// Checkpoint & Session Note Service Extensions (Direct Authed Appwrite DB Queries)

export async function getSessionNote(sessionId: string): Promise<CaptureItem | null> {
  const db = await createAuthedDatabases();
  try {
    const res = await db.listDocuments(dbId, capturesTableId, [
      Query.equal("sessionId", sessionId),
      Query.equal("isSessionNote", true),
      Query.limit(1)
    ]);
    return res.documents.length > 0 ? (res.documents[0] as unknown as CaptureItem) : await getSessionNoteFallback(db, sessionId);
  } catch (error) {
    if (isSchemaMismatchError(error)) return getSessionNoteFallback(db, sessionId);
    throw error;
  }
}

export async function upsertSessionNote(sessionId: string, noteContent: string): Promise<CaptureItem> {
  const db = await createAuthedDatabases();
  const existing = await getSessionNote(sessionId);
  
  if (existing) {
    const updated = await db.updateDocument(dbId, capturesTableId, existing.$id, {
      content: noteContent
    });
    return updated as unknown as CaptureItem;
  } else {
    const userId = await getCurrentUserId();
    
    const baseNote = {
      sessionId,
      userId,
      type: "text",
      content: noteContent,
      sourceTitle: sessionNoteMarker,
      createdAt: new Date().toISOString()
    };

    let created;
    try {
      created = await db.createDocument(dbId, capturesTableId, ID.unique(), {
        ...baseNote,
        isSessionNote: true
      });
    } catch (error) {
      if (!isSchemaMismatchError(error)) throw error;
      created = await db.createDocument(dbId, capturesTableId, ID.unique(), baseNote);
    }
    return created as unknown as CaptureItem;
  }
}

export async function getCheckpoints(sessionId: string): Promise<CaptureItem[]> {
  const db = await createAuthedDatabases();
  try {
    const res = await db.listDocuments(dbId, capturesTableId, [
      Query.equal("sessionId", sessionId),
      Query.equal("isCheckpoint", true),
      Query.orderDesc("createdAt"),
      Query.limit(100)
    ]);
    return res.documents as unknown as CaptureItem[];
  } catch (error) {
    if (isSchemaMismatchError(error)) return [];
    throw error;
  }
}

export async function createCheckpoint(
  sessionId: string,
  name: string,
  createdAt = new Date().toISOString(),
  content = "",
  options: { attachmentIds?: string[]; checkpointId?: string } = {}
): Promise<CaptureItem> {
  const db = await createAuthedDatabases();
  const userId = await getCurrentUserId();
  const checkpointId = options.checkpointId || createClientCheckpointId();
  const attachmentIds = options.attachmentIds ?? [];

  if (attachmentIds.length > 0) {
    await assignAttachmentsToCheckpoint(attachmentIds, checkpointId);
  }

  const checkpointData = {
    sessionId,
    userId,
    type: "text",
    content,
    isCheckpoint: true,
    checkpointName: name,
    createdAt
  };

  let created;
  try {
    created = await db.createDocument(dbId, capturesTableId, ID.custom(checkpointId), {
      ...checkpointData,
      aiStatus: "pending"
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) {
      if (attachmentIds.length > 0) {
        await unassignAttachmentsFromCheckpoint(attachmentIds).catch(() => {});
      }
      throw error;
    }
    try {
      created = await db.createDocument(dbId, capturesTableId, ID.custom(checkpointId), checkpointData);
    } catch (fallbackError) {
      if (attachmentIds.length > 0) {
        await unassignAttachmentsFromCheckpoint(attachmentIds).catch(() => {});
      }
      throw fallbackError;
    }
  }
  return created as unknown as CaptureItem;
}

export async function assignAttachmentsToCheckpoint(attachmentIds: string[], checkpointId: string): Promise<CaptureItem[]> {
  if (attachmentIds.length === 0) return [];
  const db = await createAuthedDatabases();
  const uniqueIds = Array.from(new Set(attachmentIds.filter(Boolean)));
  const updated = await Promise.all(
    uniqueIds.map((attachmentId) =>
      db.updateDocument(dbId, capturesTableId, attachmentId, {
        checkpointId,
        isCheckpoint: false,
        isSessionNote: false
      })
    )
  );
  return updated as unknown as CaptureItem[];
}

async function unassignAttachmentsFromCheckpoint(attachmentIds: string[]): Promise<void> {
  if (attachmentIds.length === 0) return;
  const db = await createAuthedDatabases();
  const uniqueIds = Array.from(new Set(attachmentIds.filter(Boolean)));
  await Promise.all(
    uniqueIds.map((attachmentId) =>
      db.updateDocument(dbId, capturesTableId, attachmentId, {
        checkpointId: ""
      })
    )
  );
}

function createClientCheckpointId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `cp_${random.slice(0, 28)}`;
}

export async function updateCheckpointNote(checkpointId: string, noteContent: string): Promise<CaptureItem> {
  const db = await createAuthedDatabases();
  const updated = await db.updateDocument(dbId, capturesTableId, checkpointId, {
    content: noteContent
  });
  return updated as unknown as CaptureItem;
}

export async function renameCheckpoint(checkpointId: string, name: string): Promise<CaptureItem> {
  const db = await createAuthedDatabases();
  const updated = await db.updateDocument(dbId, capturesTableId, checkpointId, {
    checkpointName: name
  });
  return updated as unknown as CaptureItem;
}

export async function deleteCheckpoint(checkpointId: string): Promise<void> {
  const db = await createAuthedDatabases();
  
  const attachments = await getCheckpointAttachments(checkpointId);
  await Promise.all(attachments.map((attachment) => db.deleteDocument(dbId, capturesTableId, attachment.$id)));
  
  await db.deleteDocument(dbId, capturesTableId, checkpointId);
}

export async function deleteCapture(captureId: string): Promise<void> {
  const db = await createAuthedDatabases();
  await db.deleteDocument(dbId, capturesTableId, captureId);
}

export async function getCheckpointAttachments(checkpointId: string): Promise<CaptureItem[]> {
  const db = await createAuthedDatabases();
  try {
    const res = await db.listDocuments(dbId, capturesTableId, [
      Query.equal("checkpointId", checkpointId),
      Query.equal("isCheckpoint", false),
      Query.orderAsc("createdAt"),
      Query.limit(100)
    ]);
    return res.documents as unknown as CaptureItem[];
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    try {
      const res = await db.listDocuments(dbId, capturesTableId, [
        Query.equal("checkpointId", checkpointId),
        Query.orderAsc("createdAt"),
        Query.limit(100)
      ]);
      return (res.documents as unknown as CaptureItem[]).filter((item) => !item.isCheckpoint);
    } catch (fallbackError) {
      if (isSchemaMismatchError(fallbackError)) return [];
      throw fallbackError;
    }
  }
}

export async function getSessionAttachments(sessionId: string): Promise<CaptureItem[]> {
  const db = await createAuthedDatabases();
  let res;
  try {
    res = await db.listDocuments(dbId, capturesTableId, [
      Query.equal("sessionId", sessionId),
      Query.equal("isCheckpoint", false),
      Query.equal("isSessionNote", false),
      Query.orderAsc("createdAt"),
      Query.limit(100)
    ]);
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    res = await db.listDocuments(dbId, capturesTableId, [
      Query.equal("sessionId", sessionId),
      Query.orderAsc("createdAt"),
      Query.limit(100)
    ]);
  }

  return (res.documents as unknown as CaptureItem[]).filter(
    (item) =>
      !item.isCheckpoint &&
      !item.isSessionNote &&
      item.sourceTitle !== sessionNoteMarker &&
      !item.checkpointId?.trim() &&
      ["url", "video", "file", "pdf", "image", "audio"].includes(item.type)
  );
}

export async function getAllSessionSources(sessionId: string): Promise<CaptureItem[]> {
  const db = await createAuthedDatabases();
  let res;
  try {
    res = await db.listDocuments(dbId, capturesTableId, [
      Query.equal("sessionId", sessionId),
      Query.equal("isCheckpoint", false),
      Query.equal("isSessionNote", false),
      Query.orderDesc("createdAt"),
      Query.limit(100)
    ]);
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    res = await db.listDocuments(dbId, capturesTableId, [Query.equal("sessionId", sessionId), Query.orderDesc("createdAt"), Query.limit(100)]);
  }
  
  return (res.documents as unknown as CaptureItem[]).filter(
    item => !item.isCheckpoint && !item.isSessionNote && item.sourceTitle !== sessionNoteMarker && ["url", "video", "file", "pdf", "image", "audio"].includes(item.type)
  );
}

export async function addAttachment(
  sessionId: string,
  checkpointId: string | null,
  type: CaptureType,
  data: Partial<CaptureItem>
): Promise<CaptureItem> {
  const db = await createAuthedDatabases();
  const userId = data.userId || await getCurrentUserId();

  const baseAttachment = compactDocumentData({
    sessionId,
    userId,
    type,
    content: data.content || "",
    sourceTitle: data.sourceTitle || "",
    fileName: data.fileName || "",
    fileId: data.fileId || "",
    fileMimeType: data.fileMimeType || "",
    fileSize: data.fileSize,
    duration: data.duration,
    createdAt: new Date().toISOString()
  });

  let created;
  try {
    created = await db.createDocument(dbId, capturesTableId, ID.unique(), {
      ...baseAttachment,
      checkpointId: checkpointId || "",
      isCheckpoint: false,
      isSessionNote: false
    });
  } catch (error) {
    if (!isSchemaMismatchError(error)) throw error;
    created = await db.createDocument(dbId, capturesTableId, ID.unique(), baseAttachment);
  }

  const attachment = created as unknown as CaptureItem;
  return {
    ...attachment,
    sessionId,
    userId,
    type,
    content: attachment.content ?? baseAttachment.content,
    sourceUrl: attachment.sourceUrl ?? data.sourceUrl ?? baseAttachment.content,
    sourceTitle: attachment.sourceTitle ?? baseAttachment.sourceTitle,
    fileName: attachment.fileName ?? baseAttachment.fileName,
    fileId: attachment.fileId ?? baseAttachment.fileId,
    fileMimeType: attachment.fileMimeType ?? baseAttachment.fileMimeType,
    fileSize: attachment.fileSize ?? data.fileSize,
    duration: attachment.duration ?? data.duration,
    checkpointId: attachment.checkpointId ?? checkpointId ?? "",
    isCheckpoint: attachment.isCheckpoint ?? false,
    isSessionNote: attachment.isSessionNote ?? false
  };
}

function compactDocumentData<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null)
  ) as Partial<T>;
}

type CheckpointAiSource = Partial<Omit<CaptureItem, "aiKeyPoints" | "aiSourcesUsed" | "aiDiagrams" | "aiProcessedAt">> &
  Partial<Omit<CaptureDetails, "aiKeyPoints" | "aiSourcesUsed" | "aiDiagrams" | "aiProcessedAt">> & {
    aiKeyPoints?: string[] | string;
    aiSourcesUsed?: SourceReference[] | string;
    aiDiagrams?: DiagramOutput[] | string;
    aiKeyFindings?: string[] | string;
    aiProcessedAt?: string | null;
  };

function normalizeCheckpointAI(value: CheckpointAiSource): CheckpointAIData {
  const status = String(value.aiStatus || "pending").toLowerCase();
  return {
    aiTitle: value.aiTitle || "",
    aiContext: value.aiContext || "",
    aiKeyPoints: normalizeStringList(value.aiKeyPoints ?? value.aiKeyFindings),
    aiSourcesUsed: normalizeSources(value.aiSourcesUsed),
    aiDiagrams: normalizeDiagrams(value.aiDiagrams),
    aiStatus: status === "complete" || status === "processing" || status === "failed" ? status : "pending",
    aiProcessedAt: value.aiProcessedAt || null,
    aiCaptureCount: value.aiCaptureCount,
    aiError: value.aiError
  };
}

function normalizeSources(value: unknown): SourceReference[] {
  const items = parseArray(value);
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Partial<SourceReference>;
      return {
        title: String(source.title || "Untitled source"),
        source_type: source.source_type || "text",
        url: source.url || null,
        file_id: source.file_id || null,
        domain: source.domain || null
      } as SourceReference;
    })
    .filter((item): item is SourceReference => Boolean(item));
}

function normalizeDiagrams(value: unknown): DiagramOutput[] {
  const items = parseArray(value);
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const diagram = item as Partial<DiagramOutput>;
      if (!diagram.mermaid_code) return null;
      return {
        diagram_type: String(diagram.diagram_type || "Concept diagram"),
        mermaid_type: diagram.mermaid_type || "graph",
        mermaid_code: String(diagram.mermaid_code),
        explanation: String(diagram.explanation || "")
      } as DiagramOutput;
    })
    .filter((item): item is DiagramOutput => Boolean(item));
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return value.trim() ? [value] : [];
  }
}

function hasCheckpointAi(value: CheckpointAIData) {
  return (
    value.aiStatus === "processing" ||
    value.aiStatus === "failed" ||
    Boolean(value.aiContext) ||
    Boolean(value.aiKeyPoints.length) ||
    Boolean(value.aiSourcesUsed.length) ||
    Boolean(value.aiDiagrams.length)
  );
}
