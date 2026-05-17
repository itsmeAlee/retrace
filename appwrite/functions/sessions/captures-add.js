import { ID, fail, getOwnedSession, normalizeText, nowIso, ok, rowPermissions, validateCaptureType, withHandler } from './session-lib.js';

export default async (context) =>
  withHandler('captures-add', context, ['POST'], async ({ body, cfg, headers, res, tables, user }) => {
    const sessionId = String(body.sessionId ?? '').trim();
    const type = validateCaptureType(body.type);
    const content = normalizeText(body.content, 10000);

    if (!sessionId || !type || !content) {
      return fail(res, headers, 400, 'VALIDATION_ERROR', 'Session, type, and content are required.');
    }

    const session = await getOwnedSession({ tables, cfg, sessionId, userId: user.$id });
    const now = nowIso();
    const capture = await tables.createRow({
      databaseId: cfg.dbId,
      tableId: cfg.capturesTableId,
      rowId: ID.unique(),
      data: {
        sessionId: session.$id,
        userId: user.$id,
        type,
        content,
        sourceUrl: normalizeText(body.sourceUrl, 2000),
        sourceTitle: normalizeText(body.sourceTitle, 500),
        note: normalizeText(body.note, 2000),
        createdAt: now,
      },
      permissions: rowPermissions(user.$id),
    });

    await tables.updateRow({
      databaseId: cfg.dbId,
      tableId: cfg.sessionsTableId,
      rowId: session.$id,
      data: {
        captureCount: Number(session.captureCount ?? 0) + 1,
        updatedAt: now,
      },
    });

    return ok(res, headers, { capture });
  });
