"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../Icon";

const navItems = [
  { href: "/", icon: "home" as const, label: "Home" },
  { href: "/sessions", icon: "sessions" as const, label: "Sessions" },
  { href: "/", icon: "inbox" as const, label: "Inbox" }
];

type SidebarProps = {
  onNewSession?: () => void;
  onLogout?: () => void;
  userName?: string;
};

export function Sidebar({ onLogout, onNewSession, userName = "Ali" }: SidebarProps) {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings");

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-sidebar flex-col border-r border-border bg-surface px-6 py-8 md:flex">
      <div>
        <div className="font-heading text-xl font-bold text-text-primary">Retrace</div>
        <p className="mt-1 text-sm font-semibold text-text-muted">Modern Scholar</p>
      </div>

      <nav className="mt-10 flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
          <Link
            className={`flex h-11 items-center justify-between rounded-pill px-4 text-md transition-colors ${
              active ? "bg-primary/10 text-primary" : "text-text-primary hover:bg-bg"
            }`}
            href={item.href}
            key={item.label}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5" name={item.icon} />
              {item.label}
            </span>
          </Link>
          );
        })}
      </nav>

      <div>
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-pill bg-primary text-[14px] font-medium text-white transition-colors hover:bg-primary-hover"
          onClick={onNewSession}
          type="button"
        >
          <Icon className="h-4 w-4" name="add" />
          New Session
        </button>
        <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-pill bg-primary/10 text-primary">
              <Icon className="h-5 w-5" name="user" />
            </div>
            <span className="text-[14px] font-bold text-text-primary">{userName}</span>
          </div>
          <Link
            aria-label="Settings"
            className={`rounded-pill p-2 transition-colors ${settingsActive ? "bg-primary/10 text-primary" : "text-text-muted hover:text-primary"}`}
            href="/settings"
          >
            <Icon className="h-5 w-5" name="settings" />
          </Link>
        </div>
        <button
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-pill border border-border bg-surface text-[14px] font-medium text-text-muted transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          onClick={onLogout}
          type="button"
        >
          <Icon className="h-4 w-4" name="sign-out" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
