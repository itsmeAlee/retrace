 "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../Icon";

const tabs = [
  { href: "/", icon: "home" as const, label: "Home" },
  { href: "/sessions", icon: "sessions" as const, label: "Sessions" },
  { href: "/", icon: "inbox" as const, label: "Inbox" },
  { href: "/settings", icon: "settings" as const, label: "Settings" }
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex h-bottom-tab w-full items-center justify-around border-t border-border bg-surface md:hidden">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
        <Link className={`flex flex-col items-center gap-1 text-xs ${active ? "text-primary" : "text-text-muted"}`} href={tab.href} key={tab.label}>
          <Icon className="h-5 w-5" name={tab.icon} />
          <span>{tab.label}</span>
        </Link>
        );
      })}
    </nav>
  );
}
