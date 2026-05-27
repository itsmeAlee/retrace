"use client";

import type { Models } from "appwrite";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { getUser, logout } from "../../lib/auth";
import { BottomTabBar } from "./BottomTabBar";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  children: (context: { firstName: string; user: Models.User<Models.Preferences> | null; onLogout: () => Promise<void> }) => ReactNode;
  contentClassName?: string;
  onNewSession?: () => void;
};

export function AppShell({ children, contentClassName = "mx-auto max-w-[1200px] px-5 py-10 md:px-12", onNewSession }: AppShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [checked, setChecked] = useState(false);

  const firstName = useMemo(() => {
    const label = user?.name || user?.email || "there";
    return label.trim().split(/\s+/)[0] || "there";
  }, [user]);

  useEffect(() => {
    let active = true;
    getUser().then(async (currentUser) => {
      if (!active) return;
      if (!currentUser) {
        await logout();
        if (!active) return;
        router.replace("/auth/signin");
        return;
      }
      setUser(currentUser);
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    await logout();
    router.push("/auth/signin");
  }

  if (!checked) {
    return <div className="min-h-screen bg-bg" />;
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Sidebar onLogout={handleLogout} onNewSession={onNewSession} userName={firstName} />
      <main className="min-h-screen pb-[80px] md:ml-sidebar md:pb-16">
        <div className={contentClassName}>{children({ firstName, user, onLogout: handleLogout })}</div>
      </main>
      <BottomTabBar />
    </div>
  );
}
