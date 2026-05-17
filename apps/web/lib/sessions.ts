"use client";

import { ExecutionMethod } from "appwrite";
import { functions } from "./appwrite";

export type SessionStatus = "active" | "paused" | "completed" | "archived";
export type CaptureType = "text" | "url" | "video" | "note" | "audio";

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
  sessionId: string;
  userId: string;
  type: CaptureType;
  content: string;
  sourceUrl?: string;
  sourceTitle?: string;
  note?: string;
  createdAt: string;
};

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

const functionEndpoints = {
  create: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_CREATE ?? `${endpoint}/functions/sessions-create/executions`,
  list: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_LIST ?? `${endpoint}/functions/sessions-list/executions`,
  get: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_GET ?? `${endpoint}/functions/sessions-get/executions`,
  update: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_UPDATE ?? `${endpoint}/functions/sessions-update/executions`,
  delete: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SESSIONS_DELETE ?? `${endpoint}/functions/sessions-delete/executions`,
  addCapture: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_CAPTURES_ADD ?? `${endpoint}/functions/captures-add/executions`,
  listCaptures: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_CAPTURES_LIST ?? `${endpoint}/functions/captures-list/executions`
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

export async function addCapture(
  sessionId: string,
  type: CaptureType,
  content: string,
  sourceUrl?: string,
  sourceTitle?: string,
  note?: string
) {
  const result = await executeFunction<{ capture: CaptureItem }>(functionEndpoints.addCapture, ExecutionMethod.POST, {
    body: { sessionId, type, content, sourceUrl, sourceTitle, note }
  });
  return result.capture;
}

export async function listCaptures(sessionId: string, type?: CaptureType, limit = 20, offset = 0) {
  const result = await executeFunction<{ captures: CaptureItem[]; total: number }>(functionEndpoints.listCaptures, ExecutionMethod.GET, {
    query: { sessionId, type, limit, offset }
  });
  return { captures: result.captures, total: result.total };
}
