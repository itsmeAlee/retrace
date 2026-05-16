import { retraceTheme } from "@retrace/config/tailwind";
import { Button } from "@retrace/ui";

void Button;

export default function Page() {
  return <div style={{ color: retraceTheme.colors.textPrimary }}>Web app</div>;
}
