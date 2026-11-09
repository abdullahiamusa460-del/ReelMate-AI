"use client";

import { Eye, Heart, Loader2, LockKeyhole, MessageSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Reel } from "@/types";
import { useApp } from "@/components/providers/app-provider";
import { formatAgo, formatCompact } from "@/lib/format";
import { getReelInsight, getReelState } from "@/lib/reel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ReelThumbnail } from "@/components/reels/reel-thumbnail";

const STATE_BADGE = {
  analyzed: { label: "Analyzed", variant: "emerald" as const },
  analyzing: { label: "Analyzing", variant: "purple" as const },
  awaiting: { label: "Awaiting", variant: "amber" as const },
  unavailable: { label: "Unavailable", variant: "rose" as const },
};

export function ReelCard({ reel, onOpen }: { reel: Reel; onOpen: (reel: Reel) => void }) {
  const { analyses, analyzing, analyzeReel, mode } = useApp();
  const insight = getReelInsight(reel, analyses);
  const state = getReelState(reel, analyses, analyzing);
  const badge = STATE_BADGE[state];
  const needsUpload = !reel.accessible || reel.uploadRequired;

  return (
    <Panel className="group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.13]">
      <button
        type="button"
        onClick={() => onOpen(reel)}
        aria-label={`Open analysis for ${reel.caption}`}
        className="relative block w-full overflow-hidden"
      >
        <ReelThumbnail reel={reel} className="aspect-[16/10] w-full" />
        <span className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/[0.08]" />
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[9.5px] text-white/30">@{reel.creator.replace("@", "")}</span>
            <span className="size-0.5 rounded-full bg-white/20" />
            <span className="text-[9.5px] text-white/30">{formatAgo(reel.receivedMinutesAgo)}</span>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        <button type="button" onClick={() => onOpen(reel)} className="mt-2 text-left">
          <h3 className="line-clamp-2 font-display text-[13.5px] leading-snug font-semibold text-white/90 transition group-hover:text-white">
            {reel.accessible ? reel.caption : "Reel media unavailable"}
          </h3>
        </button>

        <p className="mt-1 text-[10px] text-white/30">
          Shared by @{reel.sharedBy} ·{" "}
          <span className="text-white/25">
            {mode === "live" ? "Instagram conversation" : "demo conversation"}
          </span>
        </p>

        {reel.accessible ? (
          insight ? (
            <p className="mt-3 line-clamp-3 flex-1 text-[11px] leading-relaxed text-white/45">
              {insight.summary}
            </p>
          ) : (
            <div className="mt-3 flex-1 rounded-lg border border-dashed border-white/[0.09] bg-white/[0.015] p-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-white/50">
                {state === "analyzing" ? (
                  <>
                    <Loader2 className="size-3 animate-spin text-violet-300" />
                    {mode === "live" ? "Analyzing media…" : "Simulating analysis…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3 text-amber-300/70" />
                    Not analyzed yet
                  </>
                )}
              </p>
              <p className="mt-1 text-[9.5px] leading-relaxed text-white/25">
                {mode === "live"
                  ? "Analysis starts only after the actual media is downloaded or uploaded."
                  : "Run the demo analysis to preview summary, topics and suggested replies."}
              </p>
            </div>
          )
        ) : (
          <div className="mt-3 flex flex-1 items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
            <LockKeyhole className="mt-0.5 size-3 shrink-0 text-white/30" />
            <p className="text-[10px] leading-relaxed text-white/35">{reel.inaccessibleReason}</p>
          </div>
        )}

        {insight && insight.topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {insight.topics.slice(0, 3).map((topic) => (
              <Badge key={topic} variant="purple" className="text-[9px]">
                {topic}
              </Badge>
            ))}
            {insight.topics.length > 3 && (
              <Badge variant="neutral" className="text-[9px]">
                +{insight.topics.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 border-t border-white/[0.05] pt-2.5 text-[9.5px] text-white/30">
          {reel.views !== null && (
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" />
              {formatCompact(reel.views)}
            </span>
          )}
          {reel.likes !== null && (
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3" />
              {formatCompact(reel.likes)}
            </span>
          )}
          {insight && (
            <span className="inline-flex items-center gap-1 text-violet-300/60">
              <Sparkles className="size-3" />
              {insight.topics.length} topics
            </span>
          )}
          <span className="ml-auto text-white/20">{formatAgo(reel.receivedMinutesAgo)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.012] px-3 py-2.5">
        <Link
          href={`/inbox?conversation=${reel.conversationId}`}
          className={buttonClasses("ghost", "sm", "flex-1")}
        >
          <MessageSquare className="size-3.5" />
          Conversation
        </Link>
        {state === "awaiting" || state === "analyzing" ? (
          needsUpload ? (
            <Button size="sm" variant="subtle" className="flex-1" onClick={() => onOpen(reel)}>
              <LockKeyhole className="size-3.5" />
              Upload video
            </Button>
          ) : (
            <Button
              size="sm"
              variant="subtle"
              className="flex-1"
              onClick={() => analyzeReel(reel.id)}
              disabled={state === "analyzing"}
            >
              {state === "analyzing" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Working…
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  {mode === "live" ? "Analyze" : "Run demo"}
                </>
              )}
            </Button>
          )
        ) : (
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => onOpen(reel)}>
            {state === "unavailable" ? "Upload to analyze" : "View analysis"}
          </Button>
        )}
      </div>
    </Panel>
  );
}
