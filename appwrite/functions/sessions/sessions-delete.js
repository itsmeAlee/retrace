import { Query, fail, getOwnedSession, ok, withHandler } from './session-lib.js';

export default async (context) =>
  withHandler('sessions-delete', context, ['DELETE'], async ({ body, cfg, headers, res, storage, tables, user }) => {
    const sessionId = String(body.sessionId ?? '').trim();
    if (!sessionId) {
      return fail(res, headers, 400, 'VALIDATION_ERROR', 'Session ID is required.');
    }

    const session = await getOwnedSession({ tables, cfg, sessionId, userId: user.$id });

    while (true) {
      const details = await tables.listRows({
        databaseId: cfg.dbId,
        tableId: cfg.captureDetailsTableId,
        queries: [Query.equal('sessionId', session.$id), Query.limit(100)],
      }).catch(() => ({ rows: [] }));

      const rows = details.rows ?? [];
      if (rows.length === 0) {
        break;
      }

      await Promise.all(rows.map(async (row) => {
        if (row.detailsFileId) {
          await storage.deleteFile({
            bucketId: cfg.captureDetailsBucketId,
            fileId: row.detailsFileId,
          }).catch(() => undefined);
        }
        await tables.deleteRow({
          databaseId: cfg.dbId,
          tableId: cfg.captureDetailsTableId,
          rowId: row.$id,
        }).catch(() => undefined);
      }));

      if (rows.length < 100) {
        break;
      }
    }

    while (true) {
      const captures = await tables.listRows({
        databaseId: cfg.dbId,
        tableId: cfg.capturesTableId,
        queries: [Query.equal('sessionId', session.$id), Query.limit(100)],
      });

      const rows = captures.rows ?? [];
      if (rows.length === 0) {
        break;
      }

      await Promise.all(rows.map(async (row) => {
        if (row.fileId) {
          await storage.deleteFile({
            bucketId: cfg.sessionFilesBucketId,
            fileId: row.fileId,
          }).catch(() => undefined);
        }
        await tables.deleteRow({
          databaseId: cfg.dbId,
          tableId: cfg.capturesTableId,
          rowId: row.$id,
        });
      }));

      if (rows.length < 100) {
        break;
      }
    }

    await tables.deleteRow({
      databaseId: cfg.dbId,
      tableId: cfg.sessionsTableId,
      rowId: session.$id,
    });

    return ok(res, headers);
  });
