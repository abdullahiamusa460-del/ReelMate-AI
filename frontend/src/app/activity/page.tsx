"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  CircleCheck,
  CircleSlash,
  Download,
  Film,
  History,
  MessageSquare,
  Plug,
  Search,
  Send,
  Server,
  TriangleAlert,
} from "lucide-react";
import type { ActivityItem, ActivityKind, ActivityStatus } from "@/types";
import { useApp } from "@/components/providers/app-provider";
import { useSimulatedLoading } from "@/lib/useSimulatedLoading";
import { cn } from "@/lib/cn";
import { formatAgo } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { ListSkeleton } from "@/components/ui/skeleton";

type KindFilter = "all" | ActivityKind;
type StatusFilter = "all" | ActivityStatus;

const KIND_META: Record<
  ActivityKind,
  { icon: typeof Film; label: string; style: string; dot: string }
> = {
  message: {
    icon: MessageSquare,
    label: "Message",
    style: "border-sky-400/20 bg-sky-500/[0.08] text-sky-300",
    dot: "bg-sky-400",
  },
  reel: {
    icon: Film,
    label: "Reel",
    style: "border-violet-400/20 bg-violet-500/[0.08] text-violet-300",
    dot: "bg-violet-400",
  },
  reply: {
    icon: Send,
    label: "Reply",
    style: "border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300",
    dot: "bg-emerald-400",
  },
  integration: {
    icon: Plug,
    label: "Integration",
    style: "border-amber-400/20 bg-amber-500/[0.08] text-amber-300",
    dot: "bg-amber-400",
  },
  system: {
    icon: Server,
    label: "System",
    style: "border-white/10 bg-white/[0.05] text-white/45",
    dot: "bg-white/40",
  },
};

const STATUS_META: Record<
  ActivityStatus,
  { icon: typeof CircleCheck; variant: "emerald" | "amber" | "rose" }
> = {
  completed: { icon: CircleCheck, variant: "emerald" },
  skipped: { icon: CircleSlash, variant: "amber" },
  failed: { icon: TriangleAlert, variant: "rose" },
};

function TimelineItem({ item, isLast }: { item: ActivityItem; isLast: boolean }) {
  const kind = KIND_META[item.kind];
  const status = STATUS_META[item.status];
  const Icon = kind.icon;
  const StatusIcon = status.icon;

  return (
    <li className="relative pl-12">
      {!isLast && (
        <span
          aria-hidden
          className="absolute top-9 bottom-0 left-[19px] w-px bg-gradient-to-b from-white/[0.09] to-transparent"
        />
      )}
      <span
        className={cn(
          "absolute top-1.5 left-0 grid size-10 place-items-center rounded-xl border",
          kind.style,
        )}
      >
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <Link
        href={
          item.conversationId ? `/inbox?conversation=${item.conversationId}` : "/inbox"
        }
        className="group mb-2 flex items-start gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-white/[0.06] hover:bg-white/[0.025]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-white/85">{item.title}</p>
            <Badge variant={status.variant} className="text-[9px]">
              <StatusIcon className="size-2.5" />
              <span className="capitalize">{item.status}</span>
            </Badge>
            <span className="ml-auto text-[9.5px] text-white/25">
              {formatAgo(item.minutesAgo)}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">{item.detail}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[9.5px] text-white/30">
              <span className={cn("size-1 rounded-full", kind.dot)} />
              {kind.label}
            </span>
            <span className="size-0.5 rounded-full bg-white/20" />
            <span className="text-[9.5px] text-white/30">@{item.username}</span>
          </div>
        </div>
        <ChevronRight className="mt-1 size-3.5 shrink-0 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
      </Link>
    </li>
  );
}

export default function ActivityPage() {
  const simulated = useSimulatedLoading(650);
  const { notify, activity, ready, mode } = useApp();
  const loading = simulated || !ready;
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const activityKinds: ActivityKind[] = ["message", "reel", "reply", "integration", "system"];

  const counts = useMemo(
    () => ({
      all: activity.length,
      message: activity.filter((item) => item.kind === "message").length,
      reel: activity.filter((item) => item.kind === "reel").length,
      reply: activity.filter((item) => item.kind === "reply").length,
      integration: activity.filter((item) => item.kind === "integration").length,
      system: activity.filter((item) => item.kind === "system").length,
    }),
    [activity],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activity.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (status !== "all" && item.status !== status) return false;
      if (!normalized) return true;
      return [item.title, item.detail, item.username].join(" ").toLowerCase().includes(normalized);
    });
  }, [activity, kind, status, query]);

  const groups = useMemo(
    () =>
      [
        { label: "Today", items: filtered.filter((item) => item.minutesAgo < 1440) },
        {
          label: "Yesterday",
          items: filtered.filter(
            (item) => item.minutesAgo >= 1440 && item.minutesAgo < 2880,
          ),
        },
        { label: "Earlier", items: filtered.filter((item) => item.minutesAgo >= 2880) },
      ].filter((group) => group.items.length > 0),
    [filtered],
  );

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Activity history
            {mode === "live" ? (
              <Badge variant="emerald" dot className="ml-1">
                Live log
              </Badge>
            ) : (
              <DemoBadge className="ml-1" />
            )}
          </>
        }
        title="Everything the assistant did"
        description={
          mode === "live"
            ? "A timeline of messages received, Reels analyzed, and replies delivered through the backend."
            : "Demo activity events — no real Instagram activity is recorded."
        }
        actions={
          <>
            <Badge variant="neutral" className="max-sm:hidden">
              <History className="size-3" />
              {counts.all} sample events
            </Badge>
            <Button
              variant="secondary"
              onClick={() =>
                notify({
                  type: "info",
                  title: "Export unavailable",
                  message: "Activity export is not part of this frontend demo.",
                })
              }
            >
              <Download className="size-4" />
              Export
            </Button>
          </>
        }
      />

      <div className="panel mb-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            label="Filter activity by type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "All events", count: counts.all },
              { value: "message", label: "Messages", count: counts.message },
              { value: "reel", label: "Reels", count: counts.reel },
              { value: "reply", label: "Replies", count: counts.reply },
              { value: "integration", label: "Integrations", count: counts.integration },
              { value: "system", label: "System", count: counts.system },
            ]}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/30" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search activity…"
                aria-label="Search activity"
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pr-3 pl-8 text-xs text-white/85 placeholder:text-white/25 focus:border-violet-400/40 focus:bg-white/[0.05] focus:outline-none"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              aria-label="Filter activity by status"
              className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-white/60 focus:border-violet-400/40 focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <div>
              <h2 className="font-display text-sm font-semibold text-white">Timeline</h2>
              <p className="mt-0.5 text-[10px] text-white/35">
                {filtered.length} of {activity.length} events
              </p>
            </div>
            {mode === "live" ? (
              <Badge variant="emerald" dot>
                Live log
              </Badge>
            ) : (
              <DemoBadge label="Demo" />
            )}
          </div>

          {loading ? (
            <ListSkeleton rows={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No activity matches"
              description="Clear the filters or try a different search."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setKind("all");
                    setStatus("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="px-3 py-4 sm:px-4">
              {groups.map((group) => (
                <div key={group.label} className="mb-4 last:mb-0">
                  <div className="mb-2 flex items-center gap-2 px-2">
                    <span className="text-[9.5px] font-semibold tracking-[0.18em] text-white/30 uppercase">
                      {group.label}
                    </span>
                    <span className="h-px flex-1 bg-white/[0.05]" />
                    <span className="text-[9px] text-white/20">{group.items.length}</span>
                  </div>
                  <ul>
                    {group.items.map((item, index) => (
                      <TimelineItem
                        key={item.id}
                        item={item}
                        isLast={index === group.items.length - 1}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="font-display text-xs font-semibold text-white">Event summary</h3>
            <div className="mt-3 space-y-2.5">
              {(Object.keys(KIND_META) as ActivityKind[]).map((kindKey) => {
                const meta = KIND_META[kindKey];
                const Icon = meta.icon;
                const total = counts[kindKey];
                return (
                  <div key={kindKey} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-lg border",
                        meta.style,
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="flex-1 text-[10.5px] text-white/50">{meta.label}s</span>
                    <span className="text-xs font-semibold text-white/80 tabular-nums">
                      {total}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/35">Completed</span>
                <span className="text-emerald-300/80">
                  {activity.filter((item) => item.status === "completed").length}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                <span className="text-white/35">Skipped or failed</span>
                <span className="text-amber-300/80">
                  {activity.filter((item) => item.status !== "completed").length}
                </span>
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-3.5 text-amber-300/70" />
              <h3 className="text-[11px] font-semibold text-white/80">About this history</h3>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              {mode === "live"
                ? "Entries are recorded by the backend as messages are received, Reels analyzed, and replies delivered."
                : "Demo activity events — no real Instagram activity is recorded."}
            </p>
            <Link
              href="/connection"
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-violet-300/75 transition hover:text-violet-200"
            >
              See what a real integration needs
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
