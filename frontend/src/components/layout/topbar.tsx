"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  CircleCheck,
  CircleX,
  Info,
  Menu,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useApp } from "@/components/providers/app-provider";
import { ALL_NAV_ITEMS, isActivePath } from "@/components/layout/nav";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/demo-badge";
import { StatusDot } from "@/components/ui/status-dot";
import { formatAgo } from "@/lib/format";

const NOTIFICATION_ICON = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleX,
} as const;

const NOTIFICATION_TONE = {
  success: "text-emerald-300",
  info: "text-sky-300",
  warning: "text-amber-300",
  error: "text-rose-300",
} as const;

function NotificationsMenu() {
  const { notifications, unreadCount, markAllRead, dismissNotification } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        className={cn(
          "relative grid size-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/55 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white",
          open && "border-violet-400/25 bg-violet-500/10 text-violet-200",
        )}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-rose-400 ring-2 ring-ink-950" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[70] mt-2 w-[min(22rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur-xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-white">Notifications</p>
              <p className="text-[10px] text-white/35">Demo notifications, stored locally</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-violet-300/80 transition hover:bg-violet-500/10 hover:text-violet-200 disabled:opacity-40"
            >
              <CheckCheck className="size-3" />
              Mark read
            </button>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-white/40">
                You&apos;re all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {notifications.slice(0, 8).map((notification) => {
                  const Icon = NOTIFICATION_ICON[notification.type];
                  return (
                    <li
                      key={notification.id}
                      className={cn(
                        "group flex gap-3 px-4 py-3 transition hover:bg-white/[0.025]",
                        !notification.read && "bg-violet-500/[0.035]",
                      )}
                    >
                      <Icon
                        className={cn("mt-0.5 size-4 shrink-0", NOTIFICATION_TONE[notification.type])}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="flex-1 text-[11.5px] font-medium text-white/85">
                            {notification.title}
                          </p>
                          <span className="shrink-0 text-[9.5px] text-white/30">
                            {notification.createdAt === 0
                              ? "Demo"
                              : formatAgo((Date.now() - notification.createdAt) / 60_000)}
                          </span>
                        </div>
                        {notification.message && (
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/40">
                            {notification.message}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissNotification(notification.id)}
                        aria-label="Dismiss notification"
                        className="mt-0.5 hidden size-5 shrink-0 place-items-center rounded text-white/25 hover:bg-white/[0.07] hover:text-white/70 group-hover:grid"
                      >
                        <CircleX className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-white/[0.07] bg-white/[0.015] px-4 py-2">
            <p className="text-[9.5px] text-white/30">
              Notifications reflect local demo state only.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { aiEnabled, mode, backendAvailable } = useApp();
  const current = ALL_NAV_ITEMS.find((item) => isActivePath(pathname, item.href));

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/60 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
        >
          <Menu className="size-[18px]" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <span className="hidden sm:inline">Workspace</span>
            <span className="hidden sm:inline text-white/20">/</span>
            <span className="truncate text-white/55">{current?.label ?? "Dashboard"}</span>
          </div>
        </div>

        <div className="hidden sm:block">
          {mode === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-emerald-200/90">
              <StatusDot tone="emerald" />
              Live
            </span>
          ) : (
            <DemoBadge label={backendAvailable ? "Demo workspace" : "Local preview"} />
          )}
        </div>
        <Link
          href="/"
          title="Manage the AI assistant on the dashboard"
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-full border px-2.5 text-[10.5px] font-medium transition",
            aiEnabled
              ? "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-200 hover:bg-emerald-500/[0.12]"
              : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/70",
          )}
        >
          <StatusDot tone={aiEnabled ? "emerald" : "slate"} pulse={aiEnabled} />
          <span>AI {aiEnabled ? "ON" : "OFF"}</span>
        </Link>
        <NotificationsMenu />
        <Link
          href="/assistant"
          aria-label="Open AI assistant settings"
          className="rounded-full outline-offset-2 transition hover:opacity-90"
        >
          <Avatar name="Alex Rivera" hue={268} size="sm" />
        </Link>
      </div>
    </header>
  );
}
