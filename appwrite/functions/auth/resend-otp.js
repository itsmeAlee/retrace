import {
  addMinutes,
  fail,
  generateOtp,
  getRowByEmail,
  hashOtp,
  newSalt,
  normalizeEmail,
  ok,
  secondsUntil,
  sendOtpEmail,
  validateEmail,
  withHandler,
} from './auth-lib.js';

export default async (context) => withHandler('auth-resend-otp', context, async ({
  body,
  cfg,
  headers,
  res,
  tables,
}) => {
  const email = normalizeEmail(body.email);
  if (!validateEmail(email)) {
    return fail(res, headers, 400, 'VALIDATION_ERROR', 'Enter a valid email address.');
  }

  const pending = await getRowByEmail(tables, cfg.dbId, cfg.pendingTableId, email);
  if (!pending) {
    return fail(res, headers, 404, 'NO_PENDING_SIGNUP', 'No pending signup found. Please restart signup.');
  }

  const cooldownRemaining = secondsUntil(pending.lastSentAt, cfg.resendCooldownSecs);
  if (cooldownRemaining > 0) {
    return fail(res, headers, 429, 'RESEND_COOLDOWN', 'Please wait before requesting another code.', {
      secondsRemaining: cooldownRemaining,
    });
  }

  const otp = generateOtp();
  const otpSalt = newSalt(16);
  const now = new Date();

  await tables.updateRow({
    databaseId: cfg.dbId,
    tableId: cfg.pendingTableId,
    rowId: pending.$id,
    data: {
      otpHash: hashOtp(otp, otpSalt, cfg.otpSecret),
      otpSalt,
      expiresAt: addMinutes(now, cfg.otpExpiryMinutes),
      lastSentAt: now.toISOString(),
      attempts: 0,
    },
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
