"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronRight, Sparkles, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApp } from "@/components/providers/app-provider";
import { Avatar } from "@/components/ui/avatar";
import { StatusDot } from "@/components/ui/status-dot";
import { Brand } from "@/components/layout/brand";
import { ALL_NAV_ITEMS, NAV_SECTIONS, isActivePath } from "@/components/layout/nav";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { conversations, reels } = useApp();
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unread, 0);
  const awaitingReels = reels.filter(
    (reel) => reel.analysisStatus === "pending" || reel.analysisStatus === "queued",
  ).length;

  return (
    <nav className="flex flex-col gap-5" aria-label="Main navigation">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
            {section.label}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              const badge =
                item.href === "/inbox"
                  ? unreadTotal
                  : item.href === "/reels"
                    ? awaitingReels
                    : item.badge;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200",
                      active
                        ? "bg-gradient-to-r from-violet-500/[0.16] to-indigo-500/[0.04] text-white"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/85",
                    )}
                  >
                    {active && (
                      <span className="absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b from-violet-300 to-indigo-400" />
                    )}
                    <Icon
                      className={cn(
                        "size-[17px] shrink-0 transition-colors",
                        active ? "text-violet-300" : "text-white/40 group-hover:text-white/70",
                      )}
                      strokeWidth={1.8}
                    />
                    <span className="truncate">{item.label}</span>
                    {typeof badge === "number" && badge > 0 && (
                      <span
                        className={cn(
                          "ml-auto rounded-full px-1.5 py-0.5 text-[10px] leading-none tabular-nums",
                          active
                            ? "bg-violet-400/20 text-violet-200"
                            : "bg-white/[0.06] text-white/45",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { aiEnabled, mode, connection } = useApp();
  const live = mode === "live";
  const account = connection.accountHandle
    ? `@${connection.accountHandle.replace(/^@/, "")}`
    : null;

  return (
    <div className="space-y-3">
      <Link
        href="/connection"
        className={cn(
          "flex items-start gap-2 rounded-xl border p-3 transition",
          live
            ? "border-emerald-300/15 bg-emerald-400/[0.05] hover:border-emerald-300/25 hover:bg-emerald-400/[0.08]"
            : "border-amber-300/15 bg-amber-400/[0.05] hover:border-amber-300/25 hover:bg-amber-400/[0.08]",
        )}
      >
        {live ? (
          <StatusDot tone="emerald" className="mt-1 shrink-0" />
        ) : (
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-amber-300/80" />
        )}
        <span
          className={cn(
            "text-[10.5px] leading-relaxed",
            live ? "text-emerald-100/65" : "text-amber-100/65",
          )}
        >
          <span
            className={cn(
              "block font-medium",
              live ? "text-emerald-100/90" : "text-amber-100/90",
            )}
          >
            {live ? "Live workspace" : "Demo workspace"}
          </span>
          {live
            ? `${account ?? "Instagram"} connected through Meta's official API.`
            : "Sample data only. No Instagram account is connected."}
        </span>
      </Link>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-white/55">AI assistant</span>
          <span className="flex items-center gap-1.5 text-[10px] text-white/45">
            <StatusDot tone={aiEnabled ? "emerald" : "slate"} pulse={aiEnabled} />
            {aiEnabled ? "Active" : "Paused"}
          </span>
        </div>
        <Link
          href="/"
          className="mt-2 flex items-center justify-between text-[11px] text-violet-300/80 transition hover:text-violet-200"
        >
          {aiEnabled
            ? live
              ? "Running in live mode"
              : "Running in demo mode"
            : "Turn on from dashboard"}
          <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
        <Avatar name="Alex Rivera" hue={268} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white/85">Alex Rivera</p>
          <p className="truncate text-[10px] text-white/35">Demo account</p>
        </div>
        <span className="grid size-7 place-items-center rounded-lg border border-white/[0.07] text-white/30">
          <LockKeyhole className="size-3" />
        </span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { mode } = useApp();
  const live = mode === "live";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/[0.06] bg-ink-900/55 backdrop-blur-xl lg:flex">
      <div className="px-5 pt-5 pb-4">
        <Brand />
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              live ? "bg-emerald-400" : "bg-amber-300",
            )}
          />
          <span className="text-[10px] tracking-wide text-white/40">
            {live ? "Live environment" : "Demo environment"}
          </span>
          <span className="ml-auto rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-white/35">
            v0.1
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 no-scrollbar">
        <NavLinks />
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <SidebarFooter />
      </div>
    </aside>
  );
}

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex w-[86%] max-w-[310px] flex-col border-r border-white/10 bg-ink-900 shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-lg text-white/50 transition hover:bg-white/[0.07] hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 no-scrollbar">
          <NavLinks onNavigate={onClose} />
        </div>
        <div className="border-t border-white/[0.06] p-3">
          <SidebarFooter />
        </div>
      </div>
    </div>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { conversations, reels } = useApp();
  const items = ALL_NAV_ITEMS.filter((item) => item.href !== "/connection");
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unread, 0);
  const awaitingReels = reels.filter(
    (reel) => reel.analysisStatus === "pending" || reel.analysisStatus === "queued",
  ).length;

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-ink-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          const badge =
            item.href === "/inbox"
              ? unreadTotal
              : item.href === "/reels"
                ? awaitingReels
                : item.badge;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 text-[9.5px] font-medium transition-colors",
                  active ? "text-violet-200" : "text-white/40 hover:text-white/70",
                )}
              >
                {active && (
                  <span className="absolute top-0 h-[2px] w-8 rounded-full bg-gradient-to-r from-violet-300 to-indigo-400" />
                )}
                <span className="relative">
                  <Icon className="size-[19px]" strokeWidth={active ? 2.1 : 1.7} />
                  {typeof badge === "number" && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-3.5 rounded-full bg-rose-500 px-1 text-center text-[8px] leading-[14px] font-semibold text-white">
                      {badge}
                    </span>
                  )}
                </span>
                {item.shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
