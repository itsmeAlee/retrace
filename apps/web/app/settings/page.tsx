"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { AppShell } from "../../components/app/AppShell";
import { CreateSessionModal } from "../../components/app/CreateSessionModal";
import { Toast } from "../../components/ui/Toast";

export default function SettingsPage() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [sessionOpen, setSessionOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <AppShell contentClassName="max-w-settings px-5 py-10 md:px-12" onNewSession={() => setSessionOpen(true)}>
      {({ user, onLogout }) => {
        const initials = initialsFor(user?.name || user?.email || "U");

        return (
          <>
            <header>
              <h1 className="font-heading text-auth-heading font-bold text-text-primary">Settings</h1>
              <p className="mt-1 text-base text-text-muted">Manage your account and preferences.</p>
            </header>

            <section className="mt-10 border-b border-border pb-7">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Profile</h2>
              <div className="mt-5 flex items-center justify-between gap-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-pill bg-primary text-xl font-bold text-white">{initials}</div>
                  <div className="min-w-0">
                    <p className="truncate text-md font-semibold text-text-primary">{user?.name || "No name set"}</p>
                    <p className="truncate text-sm text-text-muted">{user?.email}</p>
                  </div>
                </div>
                <button className="shrink-0 text-sm font-medium text-primary hover:underline" onClick={() => setToast("Profile editing coming soon.")} type="button">
                  Edit profile
                </button>
              </div>
            </section>

            <section className="border-b border-border py-7">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Account</h2>
              <div className="mt-4 flex items-center justify-between gap-5 py-4">
                <div>
                  <p className="text-base text-text-primary">Change password</p>
                  <p className="mt-1 text-sm text-text-muted">Update your account password.</p>
                </div>
                <button className="text-sm font-medium text-primary hover:underline" onClick={() => setToast("Coming soon.")} type="button">
                  Change →
                </button>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between gap-5 py-4">
                <div>
                  <p className="text-base text-text-primary">Sign out</p>
                  <p className="mt-1 text-sm text-text-muted">End the active session on this device.</p>
                </div>
                <button
                  className="h-secondary-control rounded-form border-[1.5px] border-border bg-surface px-4 text-sm font-medium text-text-primary transition-colors hover:border-primary/30 hover:text-primary"
                  onClick={onLogout}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            </section>

            <section className="py-7">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-error">Danger Zone</h2>
              <div className="mt-4 flex items-center justify-between gap-5 py-4">
                <div>
                  <p className="text-base text-text-primary">Delete account</p>
                  <p className="mt-1 text-sm text-text-muted">Permanently remove your account and research data.</p>
                </div>
                <button
                  className="h-secondary-control rounded-form border-[1.5px] border-error bg-surface px-4 text-sm font-medium text-error transition-colors hover:bg-error hover:text-white"
                  onClick={() => setDeleteOpen(true)}
                  type="button"
                >
                  Delete account
                </button>
              </div>
            </section>

            <DeleteConfirmModal
              onClose={() => setDeleteOpen(false)}
              onConfirm={() => {
                setDeleteOpen(false);
                setToast("Coming soon.");
              }}
              open={deleteOpen}
            />
            <Toast message={toast} />
            <CreateSessionModal onClose={() => setSessionOpen(false)} open={sessionOpen} />
          </>
        );
      }}
    </AppShell>
  );
}

function DeleteConfirmModal({ onClose, onConfirm, open }: { onClose: () => void; onConfirm: () => void; open: boolean }) {
  const reduce = useReducedMotion();

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
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-modal rounded-modal border border-border bg-surface p-8 shadow-card-hover"
            exit={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.95 }}
            onMouseDown={(event) => event.stopPropagation()}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: "easeOut" }}
          >
            <h3 className="font-heading text-xl font-semibold text-text-primary">Delete your account?</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">Are you sure? This cannot be undone.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button className="h-auth-control rounded-form border-[1.5px] border-border bg-surface text-base font-medium text-text-primary" onClick={onClose} type="button">
                Cancel
              </button>
              <button className="h-auth-control rounded-pill bg-error text-base font-medium text-white" onClick={onConfirm} type="button">
                Delete account
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function initialsFor(label: string) {
  return label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
