"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  CircleSlash,
  Film,
  MessageSquare,
  Plug,
  Send,
  Server,
  TriangleAlert,
} from "lucide-react";
import type { ActivityItem, ActivityKind, ActivityStatus } from "@/types";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/cn";
import { formatAgo } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Panel, PanelHeader } from "@/components/ui/panel";

const KIND_ICON: Record<ActivityKind, typeof Film> = {
  message: MessageSquare,
  reel: Film,
  reply: Send,
  integration: Plug,
  system: Server,
};

const KIND_STYLE: Record<ActivityKind, string> = {
  message: "border-sky-400/20 bg-sky-500/[0.08] text-sky-300",
  reel: "border-violet-400/20 bg-violet-500/[0.08] text-violet-300",
  reply: "border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300",
  integration: "border-amber-400/20 bg-amber-500/[0.08] text-amber-300",
  system: "border-white/10 bg-white/[0.05] text-white/50",
};

const STATUS_ICON: Record<ActivityStatus, typeof CircleCheck> = {
  completed: CircleCheck,
  skipped: CircleSlash,
  failed: TriangleAlert,
};

const STATUS_STYLE: Record<ActivityStatus, string> = {
  completed: "text-emerald-300/80",
  skipped: "text-amber-300/80",
  failed: "text-rose-300/80",
};

export function ActivityRow({ item, compact = false }: { item: ActivityItem; compact?: boolean }) {
  const Icon = KIND_ICON[item.kind];
  const StatusIcon = STATUS_ICON[item.status];

  return (
    <Link
      href={
        item.conversationId ? `/inbox?conversation=${item.conversationId}` : "/activity"
      }
      className="group flex items-start gap-3 px-5 py-3.5 transition hover:bg-white/[0.025]"
    >
      <span
        className={cn(
          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border",
          KIND_STYLE[item.kind],
        )}
      >
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-xs font-medium text-white/85">{item.title}</p>
          <span className="shrink-0 text-[10px] whitespace-nowrap text-white/30">
            {formatAgo(item.minutesAgo)}
          </span>
        </div>
        {!compact && (
          <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-white/40">{item.detail}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] text-white/30">@{item.username}</span>
          <span className="size-0.5 rounded-full bg-white/20" />
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[9.5px] font-medium capitalize",
              STATUS_STYLE[item.status],
            )}
          >
            <StatusIcon className="size-2.5" />
            {item.status}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function RecentActivity() {
  const { activity, mode } = useApp();

  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <div className="px-5 pt-5 sm:px-6">
        <PanelHeader
          title="Recent activity"
          description={
            mode === "live"
              ? "The latest events recorded by the backend"
              : "The latest events in the demo workspace"
          }
          action={
            <div className="flex items-center gap-2">
              {mode === "live" ? (
                <Badge variant="emerald" dot>
                  Live log
                </Badge>
              ) : (
                <DemoBadge label="Demo events" className="max-sm:hidden" />
              )}
              <Link
                href="/activity"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-violet-300/80 transition hover:bg-violet-500/10 hover:text-violet-200"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
          }
        />
      </div>
      <div className="mt-4 flex-1 divide-y divide-white/[0.045] border-t border-white/[0.05]">
        {activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-[11px] text-white/35">
            No activity recorded yet.
          </p>
        ) : (
          activity.slice(0, 5).map((item) => <ActivityRow key={item.id} item={item} />)
        )}
      </div>
      <div className="border-t border-white/[0.05] bg-white/[0.012] px-5 py-2.5">
        <p className="text-[9.5px] text-white/30">
          {mode === "live"
            ? "Events are recorded by the backend. Reply entries only count as completed when Instagram accepted the message."
            : "Demo events are stored by the backend. No Instagram activity occurred."}
        </p>
      </div>
    </Panel>
  );
}
