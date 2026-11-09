"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApp } from "@/components/providers/app-provider";
import type { AppNotification, NotificationType } from "@/types";

const ICONS: Record<NotificationType, typeof Info> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleX,
};

const TONES: Record<NotificationType, string> = {
  success: "border-emerald-400/20 text-emerald-300",
  info: "border-sky-400/20 text-sky-300",
  warning: "border-amber-400/25 text-amber-300",
  error: "border-rose-400/25 text-rose-300",
};

const AUTO_DISMISS_MS = 6500;

function Toast({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}) {
  const Icon = ICONS[notification.type];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(notification.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "relative overflow-hidden rounded-xl border bg-ink-900/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl animate-slide-in",
        TONES[notification.type].split(" ")[0],
      )}
    >
      <div className="flex gap-3 p-3.5">
        <span
          className={cn(
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border bg-white/[0.03]",
            TONES[notification.type],
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white/90">{notification.title}</p>
          {notification.message && (
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">{notification.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          aria-label="Dismiss notification"
          className="grid size-6 shrink-0 place-items-center rounded-md text-white/30 transition hover:bg-white/[0.07] hover:text-white/70"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <span className="toast-progress absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-violet-400 to-indigo-400" />
    </div>
  );
}

export function Toaster() {
  const { notifications } = useApp();
  const [mountedAt, setMountedAt] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setMountedAt(Date.now());
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const visible = useMemo(() => {
    if (mountedAt === null) return [];
    return notifications
      .filter((n) => n.createdAt > mountedAt && !dismissed.includes(n.id))
      .slice(0, 3);
  }, [notifications, mountedAt, dismissed]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-0 bottom-20 z-[90] flex w-full max-w-sm flex-col gap-2 px-4 md:bottom-6 md:px-6"
    >
      {visible.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <Toast notification={notification} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
