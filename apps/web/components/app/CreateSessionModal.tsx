"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createSession } from "../../lib/sessions";
import { Icon } from "../Icon";

type CreateSessionModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateSessionModal({ open, onClose }: CreateSessionModalProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await createSession(name, description);
      onClose();
      setName("");
      setDescription("");
      router.push(`/sessions/${session.$id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-text-primary/30 px-5 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onClose}
          transition={{ duration: reduce ? 0.15 : 0.2 }}
        >
          <motion.form
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-modal rounded-modal border border-border bg-surface p-8 shadow-card-hover"
            exit={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.95 }}
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={handleSubmit}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <h2 className="font-heading text-xl font-semibold text-text-primary">New session</h2>
                <p className="mt-2 text-sm text-text-muted">Give your session a name to get started.</p>
              </div>
              <button aria-label="Close" className="text-text-muted transition-colors hover:text-primary" type="button" onClick={onClose}>
                <Icon className="h-5 w-5" name="x" />
              </button>
            </div>

            <div className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-label-gap block text-sm font-medium text-text-muted">Session name</span>
                <input
                  className="h-auth-control w-full rounded-form border-[1.5px] border-border bg-surface px-4 text-base outline-none transition focus:border-primary focus:shadow-focus"
                  disabled={loading}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>
              <label className="block">
                <span className="mb-label-gap block text-sm font-medium text-text-muted">What are you working on? (optional)</span>
                <textarea
                  className="min-h-24 w-full resize-none rounded-form border-[1.5px] border-border bg-surface px-4 py-3 text-base outline-none transition focus:border-primary focus:shadow-focus"
                  disabled={loading}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  value={description}
                />
              </label>
            </div>

            {error ? <p className="mt-4 text-xs text-error">{error}</p> : null}

            <button
              className="mt-7 flex h-auth-control w-full items-center justify-center rounded-pill bg-primary text-base font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-75"
              disabled={loading}
              type="submit"
            >
              {loading ? <span className="h-5 w-5 animate-spin rounded-pill border-2 border-white/30 border-t-white" /> : "Create session"}
            </button>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
