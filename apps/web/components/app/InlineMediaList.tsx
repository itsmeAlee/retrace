"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type CaptureItem } from "../../lib/sessions";
import { InlineMediaBlock } from "./InlineMediaBlock";

type InlineMediaListProps = {
  attachments?: CaptureItem[];
  onDelete?: (item: CaptureItem) => void;
};

export function InlineMediaList({ attachments = [], onDelete }: InlineMediaListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {attachments.map((item) => (
          <motion.div
            key={item.$id}
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <InlineMediaBlock item={item} onDelete={onDelete} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
