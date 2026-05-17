import crypto from 'node:crypto';
import { Account, Client, ID, Query, TablesDB, Users } from 'node-appwrite';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    apiKey: process.env.APPWRITE_API_KEY ?? '',
    dbId: env('DB_ID'),
    pendingTableId: env('PENDING_SIGNUPS_COL_ID'),
    resetTableId: env('RESET_OTPS_COL_ID'),
    profilesTableId: env('PROFILES_COL_ID'),
    appUrl: env('APP_URL'),
    otpSecret: env('OTP_HMAC_SECRET'),
    otpExpiryMinutes: Number(env('OTP_EXPIRY_MINUTES')),
    maxAttempts: Number(env('OTP_MAX_ATTEMPTS')),
    resendCooldownSecs: Number(env('OTP_RESEND_COOLDOWN_SECS')),
    resendApiKey: env('RESEND_API_KEY'),
    resendFrom: env('RESEND_FROM'),
  };
}

export function services(cfg = config()) {
  if (!cfg.apiKey) {
    throw new Error('Missing Appwrite API key.');
  }

  const client = new Client()
    .setEndpoint(cfg.endpoint)
    .setProject(cfg.projectId)
    .setKey(cfg.apiKey);

  return {
    account: new Account(client),
    tables: new TablesDB(client),
    users: new Users(client),
  };
}

export async function withHandler(name, context, handler) {
  const startedAt = Date.now();
  const cfg = config();
  cfg.apiKey = context.req.headers?.['x-appwrite-key'] ?? context.req.headers?.['X-Appwrite-Key'] ?? cfg.apiKey;
  const headers = corsHeaders(context.req, cfg);

  if (context.req.method === 'OPTIONS') {
    return context.res.json({}, 204, headers);
  }

  if (context.req.method !== 'POST') {
    return fail(context.res, headers, 405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.');
  }

  try {
    const body = parseBody(context.req);
    const result = await handler({ ...context, body, cfg, headers, ...services(cfg) });
    context.log(`${name} completed in ${Date.now() - startedAt}ms`);
    return result;
  } catch (err) {
    context.error(`${name} failed in ${Date.now() - startedAt}ms: ${safeError(err)}`);
    return fail(context.res, headers, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
}

export function corsHeaders(req, cfg) {
  const origin = req.headers?.origin ?? req.headers?.Origin ?? '';
  const allowOrigin = origin === cfg.appUrl ? origin : cfg.appUrl;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-appwrite-project',
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

export function parseBody(req) {
  if (req.bodyJson && typeof req.bodyJson === 'object') {
    return req.bodyJson;
  }

  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  return JSON.parse(req.body);
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function validateEmail(email) {
  return EMAIL_PATTERN.test(email);
}

export function validateNameEmailPassword({ name, email, password }) {
  const fieldErrors = {};

  if (!String(name ?? '').trim()) {
    fieldErrors.name = 'Name is required.';
  }
  if (!validateEmail(email)) {
    fieldErrors.email = 'Enter a valid email address.';
  }
  if (!String(password ?? '')) {
    fieldErrors.password = 'Password is required.';
  } else if (String(password).length < 8) {
    fieldErrors.password = 'Password must be at least 8 characters.';
  }

  return fieldErrors;
}

export function validateReset({ email, otp, newPassword }) {
  const fieldErrors = {};
  if (!validateEmail(email)) {
    fieldErrors.email = 'Enter a valid email address.';
  }
  if (!String(otp ?? '').trim()) {
    fieldErrors.otp = 'Code is required.';
  }
  if (!String(newPassword ?? '')) {
    fieldErrors.newPassword = 'New password is required.';
  } else if (String(newPassword).length < 8) {
    fieldErrors.newPassword = 'Password must be at least 8 characters.';
  }
  return fieldErrors;
}

export function nowIso() {
  return new Date().toISOString();
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

export function isExpired(iso) {
  return new Date(iso).getTime() <= Date.now();
}

export function secondsUntil(iso, cooldownSecs) {
  const readyAt = new Date(iso).getTime() + cooldownSecs * 1000;
  return Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function newSalt(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashOtp(otp, salt, secret) {
  return crypto.createHmac('sha256', `${salt}${secret}`).update(String(otp)).digest('hex');
}

export function timingSafeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function encryptPassword(password, secret) {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(password), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(payload, secret) {
  const [prefix, version, ivHex, tagHex, encryptedHex] = String(payload).split(':');
  if (prefix !== 'enc' || version !== 'v1' || !ivHex || !tagHex || !encryptedHex) {
    throw new Error('Invalid encrypted password payload.');
  }

  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export async function getUserByEmail(users, email) {
  const result = await users.list({
    queries: [Query.equal('email', email), Query.limit(1)],
  });
  return result.users?.[0] ?? null;
}

export async function getRowByEmail(tables, databaseId, tableId, email) {
  const result = await tables.listRows({
    databaseId,
    tableId,
    queries: [Query.equal('email', email), Query.limit(1)],
  });
  return result.rows?.[0] ?? null;
}

export async function deleteRowIfExists(tables, databaseId, tableId, row) {
  if (!row?.$id) {
    return;
  }
  await tables.deleteRow({ databaseId, tableId, rowId: row.$id });
}

export async function sendOtpEmail({ cfg, email, subject, otp, purpose }) {
  const text = [
    subject,
    '',
    `Your Retrace ${purpose} code is: ${otp}`,
    '',
    `This code expires in ${cfg.otpExpiryMinutes} minutes.`,
    'If you did not request this code, you can ignore this email.',
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: cfg.resendFrom,
      to: [email],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend email failed with ${response.status}`);
  }
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

export { ID };
