"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "../Icon";
import { NewSessionCard } from "./NewSessionCard";

type GettingStartedCardsProps = {
  onCreateSession: () => void;
};

const cards = [
  {
    title: "Create your first session",
    description: "Sessions are your focused workspace. Name it and start capturing what you find.",
    label: "Create session",
    icon: "sessions" as const,
    tone: "primary" as const,
    pill: "Start here.",
    action: "create" as const
  },
  {
    title: "Install the extension",
    description: "Capture text, links, and videos from any webpage with one click.",
    label: "Get the extension",
    icon: "post-add" as const,
    tone: "accent" as const,
    pill: "Recommended",
    action: "extension" as const
  },
  {
    title: "See how Retrace works",
    description: "Watch a 2-minute overview of sessions, captures, and AI resume cards.",
    label: "Watch overview",
    icon: "video" as const,
    tone: "neutral" as const,
    action: "overview" as const
  }
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  exit: { opacity: 0 }
};

const item = (reduce: boolean) => ({
  hidden: { opacity: 0, y: reduce ? 0 : 16 },
  show: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: reduce ? 0 : -8 }
});

export function GettingStartedCards({ onCreateSession }: GettingStartedCardsProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div animate="show" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" exit="exit" initial="hidden" variants={container}>
      {cards.map((card) => (
        <motion.button
          className={`flex min-h-session-card flex-col rounded-card bg-surface p-5 text-left shadow-card transition-colors hover:border-border-hover hover:shadow-card-hover ${
            card.tone === "primary" ? "border-[1.5px] border-primary" : "border border-border"
          }`}
          key={card.title}
          onClick={card.action === "create" ? onCreateSession : undefined}
          transition={{ duration: reduce ? 0.2 : 0.35, ease: "easeOut" }}
          type="button"
          variants={item(Boolean(reduce))}
          whileHover={reduce ? undefined : { y: -2 }}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className={`flex h-icon-lg w-icon-lg items-center justify-center rounded-pill ${
                card.tone === "primary"
                  ? "bg-primary/10 text-primary"
                  : card.tone === "accent"
                    ? "bg-accent/10 text-accent"
                    : "bg-neutral-soft text-text-muted"
              }`}
            >
              <Icon className="h-5 w-5" name={card.icon} />
            </span>
            {card.pill ? (
              <span
                className={`rounded-pill px-3 py-1 text-xs font-semibold ${
                  card.tone === "primary" ? "bg-primary text-white" : "bg-accent/15 text-draft-text"
                }`}
              >
                {card.pill}
              </span>
            ) : null}
          </div>
          <h3 className="mt-6 text-base font-semibold text-text-primary">{card.title}</h3>
          <p className="mt-1 flex-1 text-sm leading-[1.6] text-text-muted">{card.description}</p>
          <span className="mt-8 text-sm font-medium text-primary">{card.label} →</span>
        </motion.button>
      ))}
      <motion.div transition={{ duration: reduce ? 0.2 : 0.35, ease: "easeOut" }} variants={item(Boolean(reduce))}>
        <NewSessionCard onClick={onCreateSession} />
      </motion.div>
    </motion.div>
  );
}
