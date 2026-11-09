"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import type { Conversation } from "@/types";
import { cn } from "@/lib/cn";
import { formatAgo } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { DemoBadge } from "@/components/ui/demo-badge";

export type InboxFilter = "all" | "unread" | "reels";

const STATUS_LABEL: Record<Conversation["replyStatus"], { label: string; className: string }> = {
  auto_replied: { label: "AI replied", className: "text-emerald-300/80" },
  needs_review: { label: "Draft ready", className: "text-violet-300/90" },
  pending: { label: "Analysis queued", className: "text-amber-300/80" },
  skipped: { label: "Skipped", className: "text-white/30" },
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  loading,
  total,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  filter: InboxFilter;
  onFilterChange: (value: InboxFilter) => void;
  loading: boolean;
  total: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.06] px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-semibold text-white">Conversations</h2>
            <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[9.5px] text-white/35">
              {conversations.length}/{total}
            </span>
          </div>
          <DemoBadge label="Demo" />
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pr-3 pl-8 text-xs text-white/85 placeholder:text-white/25 focus:border-violet-400/40 focus:bg-white/[0.05] focus:outline-none"
          />
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <Segmented
            label="Filter conversations"
            size="sm"
            value={filter}
            onChange={onFilterChange}
            options={[
              { value: "all", label: "All" },
              { value: "unread", label: "Unread" },
              { value: "reels", label: "Reels" },
            ]}
            className="flex-1"
          />
          <span
            title="Filters are applied locally to sample data"
            className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-white/30"
          >
            <SlidersHorizontal className="size-3" />
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <ListSkeleton rows={6} />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No conversations found"
            description="Try a different search term or clear the filter. Only demo conversations exist in this preview."
            className="py-12"
          />
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {conversations.map((conversation) => {
              const active = conversation.id === selectedId;
              const last = conversation.messages[conversation.messages.length - 1];
              const preview = last.reelId
                ? "Shared a Reel"
                : last.from === "ai"
                  ? `AI: ${last.text}`
                  : last.text;
              const status = STATUS_LABEL[conversation.replyStatus];
              const hasReel = conversation.messages.some((message) => message.reelId);

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                      active
                        ? "bg-gradient-to-r from-violet-500/[0.11] to-transparent"
                        : "hover:bg-white/[0.025]",
                    )}
                  >
                    {active && (
                      <span className="absolute top-4 bottom-4 left-0 w-[2px] rounded-full bg-gradient-to-b from-violet-300 to-indigo-400" />
                    )}
                    <div className="relative shrink-0">
                      <Avatar name={conversation.displayName} hue={conversation.hue} size="md" />
                      {conversation.unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full border-2 border-ink-900 bg-rose-500 px-1 text-[9px] font-semibold text-white">
                          {conversation.unread}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-[12.5px] font-medium",
                            conversation.unread > 0 ? "text-white" : "text-white/80",
                          )}
                        >
                          {conversation.displayName}
                        </p>
                        <span className="shrink-0 text-[9.5px] text-white/30">
                          {formatAgo(last.minutesAgo)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-[10.5px]",
                          conversation.unread > 0 ? "text-white/60" : "text-white/35",
                        )}
                      >
                        {preview || "Shared a Reel"}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={cn("text-[9px] font-medium", status.className)}>
                          {status.label}
                        </span>
                        {hasReel && (
                          <>
                            <span className="size-0.5 rounded-full bg-white/20" />
                            <span className="text-[9px] text-white/25">Reel attached</span>
                          </>
                        )}
                        {conversation.isMessageRequest && (
                          <>
                            <span className="size-0.5 rounded-full bg-white/20" />
                            <span className="text-[9px] text-amber-300/60">Request</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
