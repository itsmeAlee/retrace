import { fail, getOwnedSession, ok, withHandler } from './session-lib.js';

export default async (context) =>
  withHandler('sessions-get', context, ['GET'], async ({ cfg, headers, query, res, tables, user }) => {
    const sessionId = String(query.sessionId ?? '').trim();
    if (!sessionId) {
      return fail(res, headers, 400, 'VALIDATION_ERROR', 'Session ID is required.');
    }

    try {
      const session = await getOwnedSession({ tables, cfg, sessionId, userId: user.$id });
      return ok(res, headers, { session });
    } catch (err) {
      if (err.status === 403) {
        return fail(res, headers, 403, 'FORBIDDEN', 'You do not have access to this session.');
      }
      throw err;
    }
  });
