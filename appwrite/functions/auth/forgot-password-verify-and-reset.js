import {
  deleteRowIfExists,
  fail,
  getRowByEmail,
  getUserByEmail,
  hashOtp,
  isExpired,
  normalizeEmail,
  ok,
  timingSafeEqualHex,
  validateReset,
  withHandler,
} from './auth-lib.js';

export default async (context) => withHandler('auth-forgot-password-verify-and-reset', context, async ({
  body,
  cfg,
  headers,
  res,
  tables,
  users,
}) => {
  const email = normalizeEmail(body.email);
  const otp = String(body.otp ?? '').trim();
  const newPassword = String(body.newPassword ?? '');
  const fieldErrors = validateReset({ email, otp, newPassword });

  if (Object.keys(fieldErrors).length > 0) {
    return fail(res, headers, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { fieldErrors });
  }

  const reset = await getRowByEmail(tables, cfg.dbId, cfg.resetTableId, email);
  if (!reset) {
    return fail(res, headers, 404, 'NO_RESET_REQUEST', 'No password reset request was found.');
  }

  if (isExpired(reset.expiresAt)) {
    return fail(res, headers, 410, 'OTP_EXPIRED', 'Your code has expired. Please request a new one.');
  }

  if (Number(reset.attempts) >= cfg.maxAttempts) {
    return fail(res, headers, 429, 'TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Please request a new code.');
  }

  const submittedHash = hashOtp(otp, reset.otpSalt, cfg.otpSecret);
  if (!timingSafeEqualHex(submittedHash, reset.otpHash)) {
    const attempts = Number(reset.attempts) + 1;
    await tables.updateRow({
      databaseId: cfg.dbId,
      tableId: cfg.resetTableId,
      rowId: reset.$id,
      data: { attempts },
    });

    return fail(res, headers, 400, 'INVALID_OTP', 'Incorrect code.', {
      remainingAttempts: Math.max(0, cfg.maxAttempts - attempts),
    });
  }

  const user = await getUserByEmail(users, email);
  if (!user) {
    await deleteRowIfExists(tables, cfg.dbId, cfg.resetTableId, reset);
    return fail(res, headers, 404, 'NO_RESET_REQUEST', 'No password reset request was found.');
  }

  try {
    await users.updatePassword({ userId: user.$id, password: newPassword });
    await users.deleteSessions({ userId: user.$id }).catch(() => {});
  } catch (err) {
    return fail(res, headers, 500, 'RESET_FAILED', 'Password reset failed. Please try again.');
  }

  await deleteRowIfExists(tables, cfg.dbId, cfg.resetTableId, reset);

  return ok(res, headers, { message: 'Password updated. Please sign in.' });
});
