"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CircleCheck,
  CircleX,
  Film,
  Loader2,
  LockKeyhole,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Conversation, Reel } from "@/types";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/cn";
import { getReelInsight, getReelState } from "@/lib/reel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ReelThumbnail } from "@/components/reels/reel-thumbnail";

export function ReelInsightPanel({
  conversation,
  onUseReply,
  onOpenReel,
}: {
  conversation: Conversation;
  onUseReply: (text: string) => void;
  onOpenReel: (reel: Reel) => void;
}) {
  const { analyses, analyzing, analyzeReel, reels, mode } = useApp();

  const reelIds = conversation.messages
    .map((message) => message.reelId)
    .filter((id): id is string => Boolean(id));
  const reel = reelIds.length
    ? reels.find((item) => item.id === reelIds[reelIds.length - 1])
    : undefined;

  const insight = reel ? getReelInsight(reel, analyses) : null;
  const state = reel ? getReelState(reel, analyses, analyzing) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <Sparkles className="size-3.5 text-violet-300" />
        <h2 className="font-display text-xs font-semibold text-white">AI conversation insight</h2>
        {mode === "live" ? (
          <Badge variant="emerald" dot className="ml-auto">
            Live
          </Badge>
        ) : (
          <DemoBadge label="Demo" className="ml-auto" />
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div
          className={cn(
            "rounded-xl border p-3",
            conversation.eligible
              ? "border-emerald-400/15 bg-emerald-500/[0.045]"
              : "border-rose-400/15 bg-rose-500/[0.04]",
          )}
        >
          <div className="flex items-center gap-2">
            {conversation.eligible ? (
              <CircleCheck className="size-3.5 text-emerald-300" />
            ) : (
              <CircleX className="size-3.5 text-rose-300" />
            )}
            <p
              className={cn(
                "text-[10.5px] font-medium",
                conversation.eligible ? "text-emerald-200/90" : "text-rose-200/90",
              )}
            >
              {conversation.eligible ? "Eligible for AI handling" : "Not eligible for AI handling"}
            </p>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">
            {conversation.eligibilityNote}
          </p>
        </div>

        {!reel ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015]">
            <EmptyState
              icon={Film}
              title="No Reel to analyze"
              description="This conversation has no shared Reel. The assistant can still draft a reply from the message context."
              className="py-8"
            />
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
              <button
                type="button"
                onClick={() => onOpenReel(reel)}
                className="group relative block w-full text-left"
              >
                <ReelThumbnail reel={reel} size="sm" className="h-32 w-full" />
                <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
              </button>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-[10.5px] leading-relaxed text-white/70">
                    {reel.accessible ? reel.caption : "Unavailable Reel"}
                  </p>
                  {state === "analyzed" && (
                    <Badge variant="emerald" className="shrink-0">
                      Analyzed
                    </Badge>
                  )}
                  {state === "awaiting" && (
                    <Badge variant="amber" className="shrink-0">
                      Queued
                    </Badge>
                  )}
                  {state === "unavailable" && (
                    <Badge variant="rose" className="shrink-0">
                      Private
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[9px] text-white/25">
                  Shared by @{reel.sharedBy} · {mode === "live" ? "Instagram Reel" : "demo Reel"}
                </p>
              </div>
            </div>

            {state === "unavailable" && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-500/[0.04] p-2.5 text-[10px] leading-relaxed text-amber-100/60">
                <LockKeyhole className="mt-0.5 size-3 shrink-0" />
                <span>
                  {reel.inaccessibleReason}
                  {reel.uploadRequired && (
                    <span className="mt-1 block text-amber-100/40">
                      Open the Reel to upload the video file if you own the rights to it.
                    </span>
                  )}
                </span>
              </div>
            )}

            {insight ? (
              <>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="size-3 text-violet-300" />
                    <h3 className="text-[9.5px] font-semibold tracking-wider text-white/45 uppercase">
                      Reel summary
                    </h3>
                  </div>
                  <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[10.5px] leading-relaxed text-white/55">
                    {insight.summary}
                  </p>
                </div>

                <div>
                  <h3 className="mb-1.5 text-[9.5px] font-semibold tracking-wider text-white/45 uppercase">
                    Topics
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {insight.topics.map((topic) => (
                      <Badge key={topic} variant="purple" className="text-[9px]">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>

                {insight.suggestedReplies.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <h3 className="text-[9.5px] font-semibold tracking-wider text-white/45 uppercase">
                        Suggested replies
                      </h3>
                      <span className="text-[8.5px] text-white/25">Use →</span>
                    </div>
                    <ul className="space-y-1.5">
                      {insight.suggestedReplies.map((reply) => (
                        <li key={reply.tone}>
                          <button
                            type="button"
                            onClick={() => onUseReply(reply.text)}
                            className="group w-full rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 text-left transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[8.5px] font-medium tracking-wide text-violet-300/60 uppercase">
                                {reply.tone}
                              </span>
                              <Wand2 className="size-2.5 text-white/20 transition group-hover:text-violet-300" />
                            </div>
                            <p className="mt-1 text-[10px] leading-relaxed text-white/55 group-hover:text-white/80">
                              {reply.text}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : state !== "unavailable" ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-3 text-center">
                <p className="text-[10.5px] text-white/50">Analysis not generated yet</p>
                <p className="mt-1 text-[9.5px] leading-relaxed text-white/25">
                  {mode === "live"
                    ? "Analysis starts only after the actual media is downloaded or uploaded."
                    : "Demo analysis uses pre-written sample content for stored sample Reels."}
                </p>
                <Button
                  size="sm"
                  variant="subtle"
                  className="mt-2.5"
                  onClick={() => analyzeReel(reel.id)}
                  disabled={state === "analyzing"}
                >
                  {state === "analyzing" ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3" />
                      {mode === "live" ? "Analyze media" : "Run demo analysis"}
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <Link
          href="/reels"
          className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] text-white/45 transition hover:border-violet-400/20 hover:text-white/75"
        >
          Open Reel Intelligence
          <ArrowUpRight className="size-3" />
        </Link>
        <p className="mt-2 text-[8.5px] leading-relaxed text-white/20">
          {mode === "live"
            ? "Insights come from the configured AI provider after media access. Nothing is sent from this panel."
            : "Demo insights may be pre-written sample content. No Instagram message is sent."}
        </p>
      </div>
    </div>
  );
}
