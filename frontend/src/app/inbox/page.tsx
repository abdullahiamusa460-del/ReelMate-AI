"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useSimulatedLoading } from "@/lib/useSimulatedLoading";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { InstagramIcon } from "@/components/icons/instagram";
import { ConversationList, type InboxFilter } from "@/components/inbox/conversation-list";
import { ChatPanel } from "@/components/inbox/chat-panel";
import { ReelInsightPanel } from "@/components/inbox/reel-insight-panel";
import { ReelDetailModal } from "@/components/reels/reel-detail-modal";

export default function InboxPage() {
  const simulated = useSimulatedLoading(650);
  const { conversations, reels, notify, ready, mode } = useApp();
  const loading = simulated || !ready;
  const [selectedId, setSelectedId] = useState<string>("");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [draft, setDraft] = useState("");
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const activeReel = activeReelId ? reels.find((reel) => reel.id === activeReelId) ?? null : null;

  // Read a deep link from the address bar after mount (no server-side params needed).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conversation = params.get("conversation");
    if (conversation && conversations.some((item) => item.id === conversation)) {
      setSelectedId(conversation);
      setMobileDetail(true);
    }
  }, [conversations]);

  // Select the first conversation once data arrives (or if the selected one disappears).
  useEffect(() => {
    if (conversations.length === 0) return;
    if (!selectedId || !conversations.some((item) => item.id === selectedId)) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === "unread" && conversation.unread === 0) return false;
      if (filter === "reels" && !conversation.messages.some((message) => message.reelId)) {
        return false;
      }
      if (!normalized) return true;
      const haystack = [
        conversation.displayName,
        conversation.username,
        ...conversation.messages.map((message) => message.text),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [conversations, query, filter]);

  const selected =
    conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0] ?? null;

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unread,
    0,
  );

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setDraft("");
    setMobileDetail(true);
  };

  const useReply = (text: string) => {
    setDraft(text);
    setMobileDetail(true);
    notify({
      type: "info",
      title: "Suggestion added to draft",
      message: "Draft stored locally only — no message was sent to Instagram.",
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="size-1.5 rounded-full bg-sky-400" />
            Instagram inbox
            {mode === "live" ? (
              <Badge variant="emerald" dot className="ml-1">
                Live
              </Badge>
            ) : (
              <DemoBadge className="ml-1" />
            )}
          </>
        }
        title="Conversations"
        description={
          <span className="hidden sm:inline">
            {mode === "live"
              ? "Review DMs received through Meta's official webhook, inspect shared Reels, and approve or send replies."
              : "Review stored demo DMs, inspect shared Reels, and generate drafts. Nothing is sent to Instagram in demo mode."}
          </span>
        }
        actions={
          <>
            <Badge variant={mode === "live" ? "emerald" : "amber"} dot className="max-sm:hidden">
              {unreadTotal} unread · {mode === "live" ? "live" : "demo"}
            </Badge>
            <Link href="/connection" className={buttonClasses("secondary", "md")}>
              <InstagramIcon className="size-4" />
              Connect Instagram
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="panel overflow-hidden">
          <div className="grid min-h-[560px] md:grid-cols-[300px_minmax(0,1fr)] wide:grid-cols-[300px_minmax(0,1fr)_330px]">
            <div className="border-r border-white/[0.06] p-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-3 h-9 w-full" />
              <div className="mt-4 space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex gap-3">
                    <Skeleton className="size-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-40" />
                      <Skeleton className="h-2 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden p-5 md:block">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-44" />
                </div>
              </div>
              <div className="mt-10 space-y-4">
                <Skeleton className="h-12 w-2/3 rounded-2xl" />
                <Skeleton className="ml-auto h-16 w-3/5 rounded-2xl" />
                <Skeleton className="h-28 w-64 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel h-[calc(100dvh-19.25rem)] min-h-[430px] overflow-hidden sm:h-[calc(100dvh-14.5rem)] lg:h-[calc(100dvh-16.75rem)] lg:min-h-[540px]">
          <div className="grid h-full grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] wide:grid-cols-[300px_minmax(0,1fr)_330px]">
            <aside
              className={cn(
                "h-full min-h-0 border-r border-white/[0.06] bg-black/[0.08]",
                mobileDetail ? "hidden md:block" : "block",
              )}
            >
              <ConversationList
                conversations={filtered}
                selectedId={selectedId}
                onSelect={selectConversation}
                query={query}
                onQueryChange={setQuery}
                filter={filter}
                onFilterChange={setFilter}
                loading={false}
                total={conversations.length}
              />
            </aside>

            <section
              className={cn(
                "h-full min-h-0 bg-gradient-to-b from-transparent to-black/[0.08]",
                mobileDetail ? "block" : "hidden md:block",
              )}
            >
              {selected ? (
                <ChatPanel
                  conversation={selected}
                  onBack={() => setMobileDetail(false)}
                  onOpenReel={(reel) => setActiveReelId(reel.id)}
                  draft={draft}
                  onDraftChange={setDraft}
                />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center text-xs text-white/40">
                  Select a conversation to view its messages.
                </div>
              )}
            </section>

            <aside className="hidden h-full min-h-0 border-l border-white/[0.06] bg-black/[0.08] wide:block">
              {selected && (
                <ReelInsightPanel
                  conversation={selected}
                  onUseReply={useReply}
                  onOpenReel={(reel) => setActiveReelId(reel.id)}
                />
              )}
            </aside>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
        <Inbox className="size-3 text-white/25" />
        <p className="text-[10px] leading-relaxed text-white/30">
          {mode === "live"
            ? "Conversations are received through Meta's official Instagram messaging webhook. Profile pictures are generated avatars, not Instagram media."
            : "Stored demo conversations only. Profile pictures are generated gradient avatars, not real Instagram media."}
        </p>
      </div>

      <ReelDetailModal
        reel={activeReel}
        open={activeReel !== null}
        onClose={() => setActiveReelId(null)}
      />
    </div>
  );
}
