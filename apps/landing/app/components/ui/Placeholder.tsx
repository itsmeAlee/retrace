import { cn } from "@/app/lib/utils";

interface PlaceholderProps {
  label: string;
  aspectRatio?: string;
  glowColor?: string;
  className?: string;
}

export function Placeholder({ label, aspectRatio = "aspect-[4/3]", glowColor, className }: PlaceholderProps) {
  return (
    <div className={cn("relative w-full", className)}>
      {glowColor && (
        <div
          className="absolute -inset-4 blur-3xl -z-10 rounded-full opacity-30"
          style={{ backgroundColor: glowColor }}
        />
      )}
      <div
        className={cn(
          "w-full bg-surface-dim/30 rounded-xl border-2 border-dashed border-border flex items-center justify-center p-8",
          aspectRatio
        )}
      >
        <p className="font-sans text-text-secondary font-medium tracking-wide text-center">
          {label}
        </p>
      </div>
    </div>
  );
}
