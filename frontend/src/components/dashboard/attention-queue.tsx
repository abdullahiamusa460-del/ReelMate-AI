"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Inbox, PauseCircle } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/cn";
import { formatAgo } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";

export function AttentionQueue() {
  const { aiEnabled, conversations } = useApp();
  const items = conversations.filter(
    (conversation) =>
      conversation.replyStatus === "needs_review" || conversation.replyStatus === "pending",
  );

  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <div className="px-5 pt-5 sm:px-6">
        <PanelHeader
          title="Needs attention"
          description="Conversations waiting on a person or a paused AI"
          action={
            <Badge variant="amber" dot>
              {items.length} open
            </Badge>
          }
        />
        {!aiEnabled && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-[10px] text-white/40">
            <PauseCircle className="size-3.5 shrink-0 text-white/30" />
            AI is paused — these items would not be processed.
          </div>
        )}
      </div>

      <ul className="mt-3 flex-1 divide-y divide-white/[0.045]">
        {items.length === 0 ? (
          <li className="px-5 py-8 text-center text-[11px] text-white/35 sm:px-6">
            Nothing needs attention right now.
          </li>
        ) : (
          <>
            {items.map((conversation) => {
              const last = conversation.messages[conversation.messages.length - 1];
              const preview = !last
                ? "No messages yet"
                : last.reelId
                  ? "Shared a Reel"
                  : last.text || "No message preview";
              const needsReview = conversation.replyStatus === "needs_review";
              return (
                <li key={conversation.id}>
                  <Link
                    href={`/inbox?conversation=${conversation.id}`}
                    className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.025] sm:px-6"
                  >
                    <Avatar name={conversation.displayName} hue={conversation.hue} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-white/85">
                          {conversation.displayName}
                        </p>
                        <span className="shrink-0 text-[9.5px] text-white/25">
                          {last ? formatAgo(last.minutesAgo) : "—"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[10.5px] text-white/40">{preview}</p>
                    </div>
                    <Badge
                      variant={needsReview ? "purple" : "amber"}
                      className="hidden shrink-0 sm:inline-flex"
                    >
                      {needsReview ? "Draft ready" : "Queued"}
                    </Badge>
                    <Clock3
                      className={cn(
                        "size-3.5 shrink-0 text-white/20 transition group-hover:text-violet-300",
                        !needsReview && "text-amber-300/50",
                      )}
                    />
                  </Link>
                </li>
              );
            })}
          </>
        )}
      </ul>

      <div className="border-t border-white/[0.05] p-3">
        <Link
          href="/inbox"
          className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] py-2 text-[11px] font-medium text-white/60 transition hover:border-violet-400/20 hover:text-white"
        >
          <Inbox className="size-3.5" />
          Open inbox
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </Panel>
  );
}
