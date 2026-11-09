"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Film,
  Loader2,
  LockKeyhole,
  MoreHorizontal,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { ChatMessage, Conversation, Reel } from "@/types";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/cn";
import { formatAgo } from "@/lib/format";
import { getReelInsight } from "@/lib/reel";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReelThumbnail } from "@/components/reels/reel-thumbnail";

const STATUS: Record<
  Conversation["replyStatus"],
  { label: string; description: string; variant: "emerald" | "purple" | "amber" | "neutral" }
> = {
  auto_replied: {
    label: "AI handled",
    description: "The assistant generated a reply for this conversation",
    variant: "emerald",
  },
  needs_review: {
    label: "Draft ready",
    description: "Your settings require review before sending",
    variant: "purple",
  },
  pending: {
    label: "Queued",
    description: "Reel analysis is still queued",
    variant: "amber",
  },
  skipped: {
    label: "Skipped",
    description: "The AI workflow would not handle this conversation",
    variant: "neutral",
  },
};

function ReelMessage({
  reel,
  onOpen,
}: {
  reel: Reel;
  onOpen: (reel: Reel) => void;
}) {
  const { analyses, mode } = useApp();
  const insight = getReelInsight(reel, analyses);

  return (
    <button
      type="button"
      onClick={() => onOpen(reel)}
      className="group w-[240px] overflow-hidden rounded-xl border border-white/10 bg-black/25 text-left transition hover:border-violet-400/30 hover:bg-black/35 sm:w-[280px]"
    >
      <ReelThumbnail reel={reel} showStats={false} className="h-28 w-full" />
      <div className="p-2.5">
        <p className="line-clamp-2 text-[10.5px] leading-relaxed text-white/70">
          {reel.accessible ? reel.caption : "This Reel is unavailable"}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[9px] text-white/35">
            <Film className="size-2.5" />
            {insight
              ? mode === "live"
                ? "Analyzed"
                : "Analyzed · demo"
              : reel.accessible
                ? "Awaiting analysis"
                : reel.uploadRequired
                  ? "Upload available"
                  : "Restricted"}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[9px] text-violet-300/70 opacity-0 transition group-hover:opacity-100">
            View
            <ArrowUpRight className="size-2.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({
  message,
  conversation,
  onOpenReel,
}: {
  message: ChatMessage;
  conversation: Conversation;
  onOpenReel: (reel: Reel) => void;
}) {
  const { reels, mode } = useApp();
  const reel = message.reelId ? reels.find((item) => item.id === message.reelId) : undefined;
  const isAi = message.from === "ai";

  return (
    <div className={cn("flex gap-2", isAi ? "justify-end" : "justify-start")}>
      {!isAi && (
        <Avatar
          name={conversation.displayName}
          hue={conversation.hue}
          size="xs"
          className="mt-auto"
        />
      )}
      <div className={cn("max-w-[82%] sm:max-w-[74%]", isAi && "flex flex-col items-end")}>
        {isAi && (
          <span className="mb-1 flex items-center gap-1 text-[9px] font-medium text-violet-300/60">
            <Sparkles className="size-2.5" />
            AI assistant{mode === "demo" ? " · demo" : ""}
          </span>
        )}
        {message.text && (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed",
              isAi
                ? "rounded-br-md border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.22] to-indigo-500/[0.12] text-violet-50/90"
                : "rounded-bl-md border border-white/[0.07] bg-white/[0.055] text-white/80",
            )}
          >
            {message.text}
          </div>
        )}
        {reel && (
          <div className={cn(message.text && "mt-1.5")}>
            <ReelMessage reel={reel} onOpen={onOpenReel} />
          </div>
        )}
        <span
          className={cn(
            "mt-1 block text-[9px] text-white/25",
            isAi ? "text-right" : "ml-1",
          )}
        >
          {formatAgo(message.minutesAgo)}
          {isAi && mode === "demo" && " · demo, not sent"}
        </span>
      </div>
    </div>
  );
}

export function ChatPanel({
  conversation,
  onBack,
  onOpenReel,
  draft,
  onDraftChange,
}: {
  conversation: Conversation;
  onBack: () => void;
  onOpenReel: (reel: Reel) => void;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const {
    analyses,
    notify,
    reels,
    mode,
    backendAvailable,
    draftReply,
    sendReply,
    status: assistantStatus,
  } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const status = STATUS[conversation.replyStatus];

  const reelIds = conversation.messages
    .map((message) => message.reelId)
    .filter((id): id is string => Boolean(id));
  const lastReel = reelIds.length
    ? reels.find((reel) => reel.id === reelIds[reelIds.length - 1])
    : undefined;
  const insight = lastReel ? getReelInsight(lastReel, analyses) : null;
  const suggestions = insight?.suggestedReplies.slice(0, 2) ?? [];

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [conversation.id, conversation.messages.length]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const result = await draftReply(conversation.id, insight?.summary);
      if (result) onDraftChange(result.text);
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const result = await sendReply(conversation.id, text);
      if (result) onDraftChange("");
    } finally {
      setSending(false);
    }
  };

  const canSend = backendAvailable && draft.trim().length > 0 && !sending;
  const deliveryEnabled = Boolean(assistantStatus?.deliveryEnabled);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white md:hidden"
        >
          <ArrowLeft className="size-4" />
        </button>
        <Avatar name={conversation.displayName} hue={conversation.hue} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-medium text-white">
              {conversation.displayName}
            </p>
            <Badge variant={status.variant} className="max-xl:hidden">
              {status.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-white/35" title={status.description}>
            @{conversation.username}
          </p>
        </div>
        {lastReel && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenReel(lastReel)}
            className="shrink-0"
          >
            <Film className="size-3.5" />
            <span className="hidden xl:inline">View Reel</span>
            <span className="xl:hidden">Reel</span>
          </Button>
        )}
        <button
          type="button"
          aria-label="Conversation options"
          title="Options are not available in this demo"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5"
      >
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[9px] font-medium tracking-wider text-white/25 uppercase">
            {mode === "live" ? "Instagram conversation" : "Demo conversation"}
          </span>
          <span className="h-px flex-1 bg-white/[0.06]" />
        </div>

        {conversation.messages.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No messages yet"
            description={
              mode === "live"
                ? "This conversation has no messages yet."
                : "This demo conversation has no messages."
            }
          />
        ) : (
          conversation.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              conversation={conversation}
              onOpenReel={onOpenReel}
            />
          ))
        )}

        <div className="flex items-center gap-2 pt-2">
          <span className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[9px] text-white/20">
            {mode === "live" ? "End of conversation" : "End of demo conversation"}
          </span>
          <span className="h-px flex-1 bg-white/[0.06]" />
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-black/10 p-3 sm:p-4">
        {suggestions.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-400/15 bg-violet-500/[0.06] px-1.5 py-1 text-[9px] text-violet-200/70">
              <Sparkles className="size-2.5" />
              Suggestions
            </span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.tone}
                type="button"
                onClick={() => {
                  onDraftChange(suggestion.text);
                  notify({
                    type: "info",
                    title: "Suggestion added to draft",
                    message:
                      deliveryEnabled
                        ? "Review the draft, then send it through Instagram."
                        : mode === "live"
                          ? "The draft is not sent until messaging permission is confirmed."
                          : "Nothing is sent to Instagram in demo mode.",
                  });
                }}
                className="max-w-[260px] shrink-0 truncate rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9.5px] text-white/50 transition hover:border-violet-400/25 hover:text-white/80"
              >
                {suggestion.text}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] focus-within:border-violet-400/30 focus-within:bg-white/[0.04]">
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={`Reply to @${conversation.username}…`}
            aria-label={`Draft reply to ${conversation.displayName}`}
            className="w-full resize-none bg-transparent px-3 pt-2.5 text-xs leading-relaxed text-white/85 placeholder:text-white/25 focus:outline-none"
          />
          <div className="flex items-center gap-2 border-t border-white/[0.05] px-2 py-1.5">
            <span
              className="inline-flex items-center gap-1 text-[9px] text-amber-200/50"
              title={
                deliveryEnabled
                  ? "Instagram accepted messages for this account"
                  : "Replies are stored but not delivered in demo mode"
              }
            >
              <LockKeyhole className="size-2.5" />
              {deliveryEnabled
                ? "Instagram delivery enabled"
                : mode === "live"
                  ? "Held as draft — messaging not permitted"
                  : "Demo only — nothing is sent"}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={generate} disabled={generating}>
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {generating ? "Drafting…" : "Draft with AI"}
                </span>
                <span className="sm:hidden">Draft</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={send}
                disabled={!canSend}
                title={
                  backendAvailable
                    ? mode === "live"
                      ? "Send through the Instagram Messaging API"
                      : "Store this reply in the demo workspace. No delivery is claimed."
                    : "The backend is unreachable, so no delivery can be attempted"
                }
                className={cn(!canSend && "cursor-not-allowed opacity-40")}
              >
                {sending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {sending ? "Sending…" : mode === "live" ? "Send" : "Save demo reply"}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-[9px] leading-relaxed text-white/25">
          {deliveryEnabled
            ? "Sending calls the official Instagram Messaging API. A reply is only marked delivered after Instagram accepts it."
            : mode === "live"
              ? "This account is connected, but messaging permission is not confirmed. Replies are stored as drafts."
              : "Drafts are saved in the demo workspace. No Instagram account is connected and no message is delivered."}
        </p>
      </div>
    </div>
  );
}
