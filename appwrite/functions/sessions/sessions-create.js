import { ID, normalizeText, nowIso, ok, fail, rowPermissions, validateSessionName, withHandler } from './session-lib.js';

export default async (context) =>
  withHandler('sessions-create', context, ['POST'], async ({ body, cfg, headers, res, tables, user }) => {
    const name = validateSessionName(body.name);
    if (name.error) {
      return fail(res, headers, 400, 'VALIDATION_ERROR', name.error);
    }

    const now = nowIso();
    const session = await tables.createRow({
      databaseId: cfg.dbId,
      tableId: cfg.sessionsTableId,
      rowId: ID.unique(),
      data: {
        userId: user.$id,
        name: name.value,
        description: normalizeText(body.description, 1000),
        status: 'active',
        captureCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      permissions: rowPermissions(user.$id),
    });

    return ok(res, headers, { session });
  });
