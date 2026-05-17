import {
  addMinutes,
  deleteRowIfExists,
  fail,
  generateOtp,
  getRowByEmail,
  getUserByEmail,
  hashOtp,
  ID,
  newSalt,
  normalizeEmail,
  ok,
  secondsUntil,
  sendOtpEmail,
  validateEmail,
  withHandler,
} from './auth-lib.js';

const GENERIC_MESSAGE = 'If an account exists with this email, a reset code has been sent.';

export default async (context) => withHandler('auth-forgot-password-init', context, async ({
  body,
  cfg,
  headers,
  res,
  tables,
  users,
}) => {
  const email = normalizeEmail(body.email);
  if (!validateEmail(email)) {
    return fail(res, headers, 400, 'VALIDATION_ERROR', 'Enter a valid email address.');
  }

  const user = await getUserByEmail(users, email);
  if (!user) {
    return ok(res, headers, { message: GENERIC_MESSAGE });
  }

  const existingReset = await getRowByEmail(tables, cfg.dbId, cfg.resetTableId, email);
  if (existingReset) {
    const cooldownRemaining = secondsUntil(existingReset.lastSentAt, cfg.resendCooldownSecs);
    if (cooldownRemaining > 0) {
      return ok(res, headers, { message: GENERIC_MESSAGE });
    }
    await deleteRowIfExists(tables, cfg.dbId, cfg.resetTableId, existingReset);
  }

  const otp = generateOtp();
  const otpSalt = newSalt(16);
  const now = new Date();

  await tables.createRow({
    databaseId: cfg.dbId,
    tableId: cfg.resetTableId,
    rowId: ID.unique(),
    data: {
      email,
      otpHash: hashOtp(otp, otpSalt, cfg.otpSecret),
      otpSalt,
      expiresAt: addMinutes(now, cfg.otpExpiryMinutes),
      lastSentAt: now.toISOString(),
      attempts: 0,
      verified: false,
      createdAt: now.toISOString(),
    },
  });

  await sendOtpEmail({
    cfg,
    email,
    subject: 'Your Retrace password reset code',
    otp,
    purpose: 'password reset',
  });

  return ok(res, headers, { message: GENERIC_MESSAGE });
});
