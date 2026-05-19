import { fail, getCaptureDetails, ok, withHandler } from './session-lib.js';

export default async (context) =>
  withHandler('captures-get-details', context, ['GET'], async ({ cfg, headers, query, res, storage, tables, user }) => {
    const captureId = String(query.captureId ?? '').trim();
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

    const details = await getCaptureDetails({
      cfg,
      storage,
      tables,
      captureId,
      userId: user.$id,
    }).catch(() => ({
      fullContent: capture.content,
      markerNote: capture.isMarker ? capture.note : '',
      aiSummary: null,
    }));

    return ok(res, headers, { details });
  });
