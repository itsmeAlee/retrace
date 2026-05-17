import { Account, Client, ID, Permission, Query, Role, TablesDB } from 'node-appwrite';

const STATUS_VALUES = new Set(['active', 'paused', 'completed', 'archived']);
const CAPTURE_TYPES = new Set(['text', 'url', 'video', 'note', 'audio']);

export function env(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function config() {
  return {
    endpoint: env('APPWRITE_FUNCTION_API_ENDPOINT', process.env.APPWRITE_ENDPOINT),
    projectId: env('APPWRITE_FUNCTION_PROJECT_ID', process.env.APPWRITE_PROJECT_ID),
    dbId: env('DB_ID'),
    sessionsTableId: env('SESSIONS_COL_ID'),
    capturesTableId: env('CAPTURE_ITEMS_COL_ID'),
    appUrl: process.env.APP_URL ?? '*',
  };
}

export function corsHeaders(req, cfg) {
  const origin = req.headers?.origin ?? req.headers?.Origin ?? '';
  const allowOrigin = cfg.appUrl === '*' ? '*' : (origin === cfg.appUrl ? origin : cfg.appUrl);

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-retrace-jwt, x-appwrite-project',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function ok(res, headers, data = {}, status = 200) {
  return res.json({ success: true, ...data }, status, headers);
}

export function fail(res, headers, status, code, message, data = {}) {
  return res.json({ success: false, error: code, message, ...data }, status, headers);
}

export async function withHandler(name, context, methods, handler) {
  const startedAt = Date.now();
  const cfg = config();
  const headers = corsHeaders(context.req, cfg);

  if (context.req.method === 'OPTIONS') {
    return context.res.json({}, 204, headers);
  }

  if (!methods.includes(context.req.method)) {
    return fail(context.res, headers, 405, 'METHOD_NOT_ALLOWED', `Use ${methods.join(' or ')} for this endpoint.`);
  }

  try {
    const jwt = getBearerToken(context.req);
    if (!jwt) {
      return fail(context.res, headers, 401, 'UNAUTHORIZED', 'Sign in is required.');
    }

    const { account, tables } = services(cfg, jwt);
    const user = await account.get();
    const body = parseBody(context.req);
    const query = parseQuery(context.req);
    const result = await handler({ ...context, body, cfg, headers, query, tables, user });
    context.log(`${name} completed in ${Date.now() - startedAt}ms`);
    return result;
  } catch (err) {
    context.error(`${name} failed in ${Date.now() - startedAt}ms: ${safeError(err)}`);
    return fail(context.res, headers, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
}

function services(cfg, jwt) {
  const client = new Client()
    .setEndpoint(cfg.endpoint)
    .setProject(cfg.projectId)
    .setJWT(jwt);

  return {
    account: new Account(client),
    tables: new TablesDB(client),
  };
}

function getBearerToken(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization ?? '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : String(req.headers?.['x-retrace-jwt'] ?? req.headers?.['X-Retrace-Jwt'] ?? '').trim();
}

export function parseBody(req) {
  try {
    if (req.bodyJson && typeof req.bodyJson === 'object') {
      return req.bodyJson;
    }
  } catch {
    return {};
  }

  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  const text = String(req.body ?? '').trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function parseQuery(req) {
  if (req.query && typeof req.query === 'object') {
    return req.query;
  }

  const source = req.queryString ?? String(req.path ?? '').split('?')[1] ?? '';
  return Object.fromEntries(new URLSearchParams(source));
}

export function normalizeText(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

export function toPositiveInt(value, fallback, max = 100) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export function nowIso() {
  return new Date().toISOString();
}

export function rowPermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export async function getOwnedSession({ tables, cfg, sessionId, userId }) {
  const session = await tables.getRow({
    databaseId: cfg.dbId,
    tableId: cfg.sessionsTableId,
    rowId: sessionId,
  });

  if (session.userId !== userId) {
    const error = new Error('Session belongs to another user.');
    error.status = 403;
    throw error;
  }

  return session;
}

export function validateSessionName(name) {
  const cleaned = normalizeText(name, 255);
  if (!cleaned) {
    return { error: 'Session name is required.' };
  }
  return { value: cleaned };
}

export function validateStatus(status) {
  const value = normalizeText(status, 20).toLowerCase();
  return STATUS_VALUES.has(value) ? value : '';
}

export function validateCaptureType(type) {
  const value = normalizeText(type, 20).toLowerCase();
  return CAPTURE_TYPES.has(value) ? value : '';
}

export function safeError(err) {
  if (!err) {
    return 'unknown error';
  }
  const code = err.code ? ` code=${err.code}` : '';
  const type = err.type ? ` type=${err.type}` : '';
  const message = err.message ? ` message=${String(err.message).replace(/\s+/g, ' ').slice(0, 180)}` : '';
  return `${err.name ?? 'Error'}${code}${type}${message}`;
}

export { ID, Query };
