import {
  ID,
  detailPayloadFromBody,
  fail,
  getOwnedSession,
  hasDetailPayload,
  normalizeText,
  nowIso,
  ok,
  previewText,
  rowPermissions,
  upsertCaptureDetails,
  validateCaptureType,
  withHandler,
} from './session-lib.js';

export default async (context) =>
  withHandler('captures-add', context, ['POST'], async ({ body, cfg, headers, res, storage, tables, user }) => {
    const sessionId = String(body.sessionId ?? '').trim();
    const type = validateCaptureType(body.type);
    const details = detailPayloadFromBody(body);
    const sourceContent = details.markerNote || details.fullContent || body.content;
    const content = previewText(sourceContent, 600);

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
        note: previewText(details.markerNote || body.note, 500),
        fileId: normalizeText(body.fileId, 255),
        fileName: normalizeText(body.fileName, 255),
        fileSize: Number.isFinite(Number(body.fileSize)) ? Number(body.fileSize) : undefined,
        fileMimeType: normalizeText(body.fileMimeType, 100),
        isMarker: Boolean(body.isMarker),
        createdAt: now,
      },
      permissions: rowPermissions(user.$id),
    });

    if (hasDetailPayload(details)) {
      await upsertCaptureDetails({
        cfg,
        storage,
        tables,
        userId: user.$id,
        sessionId: session.$id,
        captureId: capture.$id,
        details,
      });
    }

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
