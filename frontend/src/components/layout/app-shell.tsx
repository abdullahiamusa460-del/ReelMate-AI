"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, MobileDrawer, MobileTabBar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/layout/toaster";
import { ALL_NAV_ITEMS, isActivePath } from "@/components/layout/nav";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const current = ALL_NAV_ITEMS.find((item) => isActivePath(pathname, item.href));
    document.title = current ? `${current.label} · ReelMate AI` : "ReelMate AI";
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-h-dvh flex-col lg:pl-[264px]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-5 pb-24 sm:px-6 md:pb-8 lg:px-8 lg:pt-7">
          <div key={pathname} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <MobileTabBar />
      <Toaster />
    </div>
  );
}
