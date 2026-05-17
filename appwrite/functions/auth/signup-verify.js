import {
  decryptPassword,
  deleteRowIfExists,
  fail,
  getRowByEmail,
  getUserByEmail,
  hashOtp,
  ID,
  isExpired,
  normalizeEmail,
  nowIso,
  ok,
  timingSafeEqualHex,
  validateEmail,
  withHandler,
} from './auth-lib.js';

export default async (context) => withHandler('auth-signup-verify', context, async ({
  body,
  cfg,
  headers,
  res,
  tables,
  users,
}) => {
  const email = normalizeEmail(body.email);
  const otp = String(body.otp ?? '').trim();

  if (!validateEmail(email) || !otp) {
    return fail(res, headers, 400, 'VALIDATION_ERROR', 'Email and code are required.');
  }

  const pending = await getRowByEmail(tables, cfg.dbId, cfg.pendingTableId, email);
  if (!pending) {
    const existingUser = await getUserByEmail(users, email);
    if (existingUser) {
      return ok(res, headers, { requiresLogin: true, message: 'Account created. Please sign in.' });
    }
    return fail(res, headers, 404, 'NO_PENDING_SIGNUP', 'No pending signup found. Please restart signup.');
  }

  if (isExpired(pending.expiresAt)) {
    return fail(res, headers, 410, 'OTP_EXPIRED', 'Your code has expired. Please request a new one.');
  }

  if (Number(pending.attempts) >= cfg.maxAttempts) {
    return fail(res, headers, 429, 'TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Please restart signup.');
  }

  const submittedHash = hashOtp(otp, pending.otpSalt, cfg.otpSecret);
  if (!timingSafeEqualHex(submittedHash, pending.otpHash)) {
    const attempts = Number(pending.attempts) + 1;
    await tables.updateRow({
      databaseId: cfg.dbId,
      tableId: cfg.pendingTableId,
      rowId: pending.$id,
      data: { attempts },
    });

    return fail(res, headers, 400, 'INVALID_OTP', 'Incorrect code.', {
      remainingAttempts: Math.max(0, cfg.maxAttempts - attempts),
    });
  }

  const existingUser = await getUserByEmail(users, email);
  if (existingUser) {
    await deleteRowIfExists(tables, cfg.dbId, cfg.pendingTableId, pending);
    return ok(res, headers, { requiresLogin: true, message: 'Account created. Please sign in.' });
  }

  const password = decryptPassword(pending.passwordHash, cfg.otpSecret);
  const user = await users.create({
    userId: ID.unique(),
    email,
    password,
    name: pending.name,
  });

  await users.updateEmailVerification({
    userId: user.$id,
    emailVerification: true,
  });

  try {
    await tables.createRow({
      databaseId: cfg.dbId,
      tableId: cfg.profilesTableId,
      rowId: ID.unique(),
      data: {
        userId: user.$id,
        name: pending.name,
        email,
        createdAt: nowIso(),
      },
    });
  } catch (err) {
    await users.delete({ userId: user.$id }).catch(() => {});
    return fail(res, headers, 500, 'PROFILE_CREATION_FAILED', 'Signup failed. Please try again.');
  }

  await deleteRowIfExists(tables, cfg.dbId, cfg.pendingTableId, pending);

  try {
    const session = await users.createSession({ userId: user.$id });
    return ok(res, headers, { session });
  } catch (err) {
    return ok(res, headers, { requiresLogin: true, message: 'Account created. Please sign in.' });
  }
});
