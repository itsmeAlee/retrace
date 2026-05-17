import { Query, ok, toPositiveInt, withHandler } from './session-lib.js';

export default async (context) =>
  withHandler('sessions-list', context, ['GET'], async ({ cfg, headers, query, res, tables, user }) => {
    const limit = toPositiveInt(query.limit, 10, 100);
    const offset = toPositiveInt(query.offset, 0, 10000);
    const result = await tables.listRows({
      databaseId: cfg.dbId,
      tableId: cfg.sessionsTableId,
      queries: [
        Query.equal('userId', user.$id),
        Query.orderDesc('updatedAt'),
        Query.limit(limit),
        Query.offset(offset),
      ],
    });

    return ok(res, headers, { sessions: result.rows ?? [], total: result.total ?? 0 });
  });
