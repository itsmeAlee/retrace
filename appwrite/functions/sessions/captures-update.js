import {
  detailPayloadFromBody,
  fail,
  getCaptureDetails,
  getOwnedSession,
  hasDetailPayload,
  normalizeText,
  ok,
  previewText,
  upsertCaptureDetails,
  withHandler,
} from './session-lib.js';

export default async (context) =>
  withHandler('captures-update', context, ['PATCH'], async ({ body, cfg, headers, res, storage, tables, user }) => {
    const captureId = String(body.captureId ?? '').trim();
    if (!captureId) {
      return fail(res, headers, 400, 'VALIDATION_ERROR', 'Capture ID is required.');
    }

    const capture = await tables.getRow({
      databaseId: cfg.dbId,
      tableId: cfg.capturesTableId,
      rowId: captureId,
    });

    if (capture.userId !== user.$id) {
      return fail(res, headers, 403, 'FORBIDDEN', 'You do not have access to this capture.');
    }

    await getOwnedSession({ tables, cfg, sessionId: capture.sessionId, userId: user.$id });

    const details = detailPayloadFromBody(body);
    const data = {};
    if (body.content !== undefined) data.content = previewText(body.content, 600);
    if (body.sourceUrl !== undefined) data.sourceUrl = normalizeText(body.sourceUrl, 2000);
    if (body.sourceTitle !== undefined) data.sourceTitle = normalizeText(body.sourceTitle, 500);
    if (body.note !== undefined) data.note = previewText(body.note, 500);
    if (body.markerNote !== undefined) data.note = previewText(body.markerNote || body.note || '', 500);

    if (Object.keys(data).length === 0 && !hasDetailPayload(details)) {
      return fail(res, headers, 400, 'VALIDATION_ERROR', 'No supported fields were provided.');
    }

    let existingDetails = {};
    if (hasDetailPayload(details)) {
      existingDetails = await getCaptureDetails({ cfg, storage, tables, captureId: capture.$id, userId: user.$id }).catch(() => ({}));
      await upsertCaptureDetails({
        cfg,
        storage,
        tables,
        userId: user.$id,
        sessionId: capture.sessionId,
        captureId: capture.$id,
        details: { ...existingDetails, ...details },
      });
    }

    const updated = Object.keys(data).length > 0
      ? await tables.updateRow({
          databaseId: cfg.dbId,
          tableId: cfg.capturesTableId,
          rowId: capture.$id,
          data,
        })
      : capture;

    return ok(res, headers, { capture: updated, details: { ...existingDetails, ...details } });
  });
