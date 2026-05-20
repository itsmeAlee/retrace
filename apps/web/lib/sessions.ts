"use client";

import { ExecutionMethod, Databases, Query, ID, Client } from "appwrite";
import { functions } from "./appwrite";

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
  aiSummary?: string;
  isMarker?: boolean;
  createdAt: string;
  duration?: number;
  
  // New columns
  isCheckpoint?: boolean;
  checkpointName?: string;
  checkpointId?: string;
  noteContent?: string;
  isSessionNote?: boolean;
};

export type CaptureDetails = {
  fullContent?: string;
  markerNote?: string;
  aiSummary?: string | null;
  updatedAt?: string;
};

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
  aiSummary?: string | null;
  isMarker?: boolean;
};

export type UpdateCaptureInput = Partial<
  Pick<CaptureItem, "content" | "sourceUrl" | "sourceTitle" | "note" | "markerNote" | "aiSummary" | "checkpointName">
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

  constructor(message: string, code?: string) {
    super(message);
    this.name = "SessionsUiError";
    this.code = code;
  }
}

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const dbId = "retrace_auth";
const capturesTableId = "capture_items";
const sessionNoteMarker = "__retrace_session_note";

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
      return "Please sign in again.";
    case "FORBIDDEN":
      return "You do not have access to this session.";
    case "VALIDATION_ERROR":
      return message ?? "Please check the form and try again.";
    case "METHOD_NOT_ALLOWED":
      return "This action is not available right now.";
    default:
      return message ?? "Something went wrong. Please try again.";
  }
}

async function executeFunction<T>(
  functionEndpoint: string,
  method: ExecutionMethod,
  options: { body?: Record<string, unknown>; query?: Record<string, string | number | undefined> } = {}
) {
  const jwtResponse = await fetch("/api/auth/jwt", { method: "POST" }).catch(() => null);

  if (!jwtResponse?.ok) {
    throw new SessionsUiError("Please sign in again.", "UNAUTHORIZED");
  }

  const jwtData = (await jwtResponse.json().catch(() => null)) as { jwt?: string } | null;
  const jwt = jwtData?.jwt;
  if (!jwt) {
    throw new SessionsUiError("Please sign in again.", "UNAUTHORIZED");
  }

  const queryString = options.query
    ? new URLSearchParams(
        Object.entries(options.query)
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([key, value]) => [key, String(value)])
      ).toString()
    : "";

  const execution = await functions.createExecution({
    functionId: functionIdFromEndpoint(functionEndpoint),
    body: options.body ? JSON.stringify(options.body) : "",
    async: false,
    xpath: queryString ? `/?${queryString}` : "/",
    method,
    headers: {
      authorization: `Bearer ${jwt}`,
      "x-retrace-jwt": jwt,
      "content-type": "application/json"
    }
  });

  if (execution.status !== "completed" || !execution.responseBody) {
    throw new SessionsUiError("The sessions service did not respond.");
  }

  const parsed = JSON.parse(execution.responseBody) as FunctionResult<T>;
  if (!parsed.success) {
    throw new SessionsUiError(mapMessage(parsed.error, parsed.message), parsed.error);
  }

  return parsed;
}

async function createAuthedDatabases() {
  const response = await fetch("/api/auth/jwt", { method: "POST" });
  if (!response.ok) {
    throw new SessionsUiError("Please sign in again.", "UNAUTHORIZED");
  }

  const data = (await response.json()) as { jwt?: string };
  if (!data.jwt) {
    throw new SessionsUiError("Please sign in again.", "UNAUTHORIZED");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(data.jwt);
  return new Databases(client);
}

async function getCurrentUserId() {
  const response = await fetch("/api/auth/me", { method: "GET" });
  if (!response.ok) {
    throw new SessionsUiError("Please sign in again.", "UNAUTHORIZED");
  }

  const data = (await response.json().catch(() => null)) as { user?: { $id?: string } } | null;
  if (!data?.user?.$id) {
    throw new SessionsUiError("Please sign in again.", "UNAUTHORIZED");
  }

  return data.user.$id;
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
  const result = await executeFunction<{ session: RetraceSession }>(functionEndpoints.get, ExecutionMethod.GET, {
    query: { sessionId }
  });
  return result.session;
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
      Query.orderAsc("createdAt"),
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
  content = ""
): Promise<CaptureItem> {
  const db = await createAuthedDatabases();
  const userId = await getCurrentUserId();

  const created = await db.createDocument(dbId, capturesTableId, ID.unique(), {
    sessionId,
    userId,
    type: "text",
    content,
    isCheckpoint: true,
    checkpointName: name,
    createdAt
  });
  return created as unknown as CaptureItem;
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
  for (const attachment of attachments) {
    await db.deleteDocument(dbId, capturesTableId, attachment.$id);
  }
  
  await db.deleteDocument(dbId, capturesTableId, checkpointId);
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
    if (isSchemaMismatchError(error)) return [];
    throw error;
  }
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
    item => !item.isCheckpoint && !item.isSessionNote && item.sourceTitle !== sessionNoteMarker && ["url", "video", "file", "audio"].includes(item.type)
  );
}

export async function addAttachment(
  sessionId: string,
  checkpointId: string | null,
  type: CaptureType,
  data: Partial<CaptureItem>
): Promise<CaptureItem> {
  const db = await createAuthedDatabases();
  const userId = await getCurrentUserId();

  const baseAttachment = {
    sessionId,
    userId,
    type,
    content: data.content || "",
    sourceUrl: data.sourceUrl || "",
    sourceTitle: data.sourceTitle || "",
    fileName: data.fileName || "",
    fileId: data.fileId || "",
    fileMimeType: data.fileMimeType || "",
    fileSize: data.fileSize || null,
    duration: data.duration || null,
    createdAt: new Date().toISOString()
  };

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
  return created as unknown as CaptureItem;
}
