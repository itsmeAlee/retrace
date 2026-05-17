"use client";

import { motion } from "framer-motion";
import { Icon } from "../Icon";

export type InboxRowProps = {
  icon: "link" | "note" | "video";
  subtitle: string;
  title: string;
};

export function InboxRow({ icon, subtitle, title }: InboxRowProps) {
  return (
    <motion.div className="flex cursor-pointer items-center gap-5 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-surface-hover">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-bg text-primary">
        <Icon className="h-5 w-5" name={icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-text-primary">{title}</p>
        <p className="truncate text-sm text-text-muted">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-text-muted">
        <button aria-label="Assign item" className="transition-colors hover:text-primary" type="button">
          <Icon className="h-5 w-5" name="move" />
        </button>
        <button aria-label="Delete item" className="transition-colors hover:text-error" type="button">
          <Icon className="h-5 w-5" name="delete" />
        </button>
      </div>
    </motion.div>
  );
}
