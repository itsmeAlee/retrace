"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "../Icon";

export type SessionCardProps = {
  description: string;
  icon?: "document" | "image";
  items: string;
  status: "active" | "paused" | "completed" | "archived";
  time: string;
  title: string;
  onClick?: () => void;
};

const statusStyles: Record<SessionCardProps["status"], string> = {
  active: "bg-primary/10 text-primary",
  paused: "bg-accent/15 text-draft-text",
  completed: "bg-success/10 text-success",
  archived: "bg-neutral-soft text-text-muted"
};

export function SessionCard({ description, icon = "document", items, onClick, status, time, title }: SessionCardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.article
      className="flex min-h-session-card cursor-pointer flex-col rounded-card border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-hover hover:shadow-card-hover"
      onClick={onClick}
      transition={{ duration: 0.2, ease: "easeOut" }}
      whileHover={reduce ? undefined : { y: -2 }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-xl font-bold text-text-primary">{title}</h3>
        <span className={`rounded-pill px-3 py-1 text-xs font-semibold uppercase ${statusStyles[status]}`}>
          {status}
        </span>
      </div>
      <div className="mt-5 flex">
        <div className="mr-3 w-px rounded-pill bg-accent" />
        <p className="text-sm italic leading-relaxed text-text-muted">{description}</p>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm text-text-muted">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" name={icon} />
          {items}
        </span>
        <span>{time}</span>
      </div>
    </motion.article>
  );
}
