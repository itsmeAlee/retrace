import { Query, fail, getOwnedSession, ok, toPositiveInt, validateCaptureType, withHandler } from './session-lib.js';

export default async (context) =>
  withHandler('captures-list', context, ['GET'], async ({ cfg, headers, query, res, tables, user }) => {
    const sessionId = String(query.sessionId ?? '').trim();
    if (!sessionId) {
      return fail(res, headers, 400, 'VALIDATION_ERROR', 'Session ID is required.');
    }

    await getOwnedSession({ tables, cfg, sessionId, userId: user.$id });

    const queries = [
      Query.equal('sessionId', sessionId),
      Query.orderDesc('createdAt'),
      Query.limit(toPositiveInt(query.limit, 20, 100)),
      Query.offset(toPositiveInt(query.offset, 0, 10000)),
    ];

    if (query.type) {
      const type = validateCaptureType(query.type);
      if (!type) {
        return fail(res, headers, 400, 'VALIDATION_ERROR', 'Capture type is invalid.');
      }
      queries.push(Query.equal('type', type));
    }

    const result = await tables.listRows({
      databaseId: cfg.dbId,
      tableId: cfg.capturesTableId,
      queries,
    });

    return ok(res, headers, { captures: result.rows ?? [], total: result.total ?? 0 });
  });
