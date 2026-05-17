import { fail, getOwnedSession, normalizeText, nowIso, ok, validateSessionName, validateStatus, withHandler } from './session-lib.js';

export default async (context) =>
  withHandler('sessions-update', context, ['PATCH'], async ({ body, cfg, headers, res, tables, user }) => {
    const sessionId = String(body.sessionId ?? '').trim();
    if (!sessionId) {
      return fail(res, headers, 400, 'VALIDATION_ERROR', 'Session ID is required.');
    }

    const session = await getOwnedSession({ tables, cfg, sessionId, userId: user.$id });
    const data = { updatedAt: nowIso() };

    if (Object.hasOwn(body, 'name')) {
      const name = validateSessionName(body.name);
      if (name.error) {
        return fail(res, headers, 400, 'VALIDATION_ERROR', name.error);
      }
      data.name = name.value;
    }

    if (Object.hasOwn(body, 'description')) {
      data.description = normalizeText(body.description, 1000);
    }

    if (Object.hasOwn(body, 'status')) {
      const status = validateStatus(body.status);
      if (!status) {
        return fail(res, headers, 400, 'VALIDATION_ERROR', 'Status is invalid.');
      }
      data.status = status;
    }

    const updated = await tables.updateRow({
      databaseId: cfg.dbId,
      tableId: cfg.sessionsTableId,
      rowId: session.$id,
      data,
    });

    return ok(res, headers, { session: updated });
  });
