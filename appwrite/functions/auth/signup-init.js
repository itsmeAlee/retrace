import {
  addMinutes,
  deleteRowIfExists,
  encryptPassword,
  fail,
  generateOtp,
  getRowByEmail,
  getUserByEmail,
  hashOtp,
  ID,
  isExpired,
  newSalt,
  normalizeEmail,
  nowIso,
  ok,
  secondsUntil,
  sendOtpEmail,
  validateNameEmailPassword,
  withHandler,
} from './auth-lib.js';

export default async (context) => withHandler('auth-signup-init', context, async ({
  body,
  cfg,
  headers,
  res,
  tables,
  users,
}) => {
  const email = normalizeEmail(body.email);
  const name = String(body.name ?? '').trim();
  const password = String(body.password ?? '');
  const fieldErrors = validateNameEmailPassword({ name, email, password });

  if (Object.keys(fieldErrors).length > 0) {
    return fail(res, headers, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { fieldErrors });
  }

  const existingUser = await getUserByEmail(users, email);
  if (existingUser) {
    return fail(res, headers, 409, 'EMAIL_EXISTS', 'An account with this email already exists. Please sign in.');
  }

  const existingPending = await getRowByEmail(tables, cfg.dbId, cfg.pendingTableId, email);
  if (existingPending) {
    const cooldownRemaining = secondsUntil(existingPending.lastSentAt, cfg.resendCooldownSecs);
    if (!isExpired(existingPending.expiresAt) && cooldownRemaining > 0) {
      return fail(
        res,
        headers,
        429,
        'RESEND_COOLDOWN',
        'A code was already sent. Please wait before requesting another.',
        { secondsRemaining: cooldownRemaining },
      );
    }

    await deleteRowIfExists(tables, cfg.dbId, cfg.pendingTableId, existingPending);
  }

  const otp = generateOtp();
  const otpSalt = newSalt(16);
  const now = new Date();
  const row = {
    email,
    name,
    passwordHash: encryptPassword(password, cfg.otpSecret),
    otpHash: hashOtp(otp, otpSalt, cfg.otpSecret),
    otpSalt,
    expiresAt: addMinutes(now, cfg.otpExpiryMinutes),
    lastSentAt: now.toISOString(),
    attempts: 0,
    createdAt: nowIso(),
  };

  await tables.createRow({
    databaseId: cfg.dbId,
    tableId: cfg.pendingTableId,
    rowId: ID.unique(),
    data: row,
  });

  await sendOtpEmail({
    cfg,
    email,
    subject: 'Your Retrace verification code',
    otp,
    purpose: 'verification',
  });

  return ok(res, headers, { message: 'Verification code sent.' });
});
