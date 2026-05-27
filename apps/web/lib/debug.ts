export function logError(scope: string, error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error(`[Retrace] ${scope}`, {
    ...context,
    error: error instanceof Error ? error.message : error
  });
}
