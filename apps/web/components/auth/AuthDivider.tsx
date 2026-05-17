export function AuthDivider() {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-sm text-text-muted">or</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
