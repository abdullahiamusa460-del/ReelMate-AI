"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  AudioLines,
  Clock3,
  Copy,
  FileVideo,
  Heart,
  Loader2,
  MessageSquare,
  Play,
  Sparkles,
  ThumbsUp,
  TriangleAlert,
  Upload,
  Eye,
} from "lucide-react";
import type { Reel } from "@/types";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/cn";
import { formatAgo, formatCompact, formatDuration } from "@/lib/format";
import { getReelInsight, getReelState } from "@/lib/reel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Modal } from "@/components/ui/modal";
import { ReelThumbnail } from "@/components/reels/reel-thumbnail";

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0">
      <span className="inline-flex items-center gap-2 text-[11px] text-white/40">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="truncate text-right text-[11px] font-medium text-white/75">{value}</span>
    </div>
  );
}

export function ReelDetailModal({
  reel,
  open,
  onClose,
}: {
  reel: Reel | null;
  open: boolean;
  onClose: () => void;
}) {
  const { analyses, analyzing, analyzeReel, notify, uploadReel, uploading, mode } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!reel) return null;

  const insight = getReelInsight(reel, analyses);
  const state = getReelState(reel, analyses, analyzing);
  const isUploading = uploading.includes(reel.id);
  const needsUpload = !reel.accessible || reel.uploadRequired;
  const demoSeed = reel.analysisSource === "demo_seed";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    await uploadReel(reel.id, file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify({
        type: "success",
        title: "Copied to clipboard",
        message: "Text copied only — no message was sent to Instagram.",
      });
    } catch {
      notify({
        type: "info",
        title: "Copy unavailable",
        message: "Your browser blocked clipboard access. You can select the text manually.",
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Reel intelligence"
      description={`Shared by @${reel.sharedBy} · ${formatAgo(reel.receivedMinutesAgo)} · ${
        mode === "live" ? "Instagram Reel" : "demo sample"
      }`}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-[10px] leading-relaxed text-white/35">
            {demoSeed
              ? "This summary is pre-written demo content. No video was downloaded, watched, or sent to a model, and no reply is sent from this interface."
              : reel.mediaAccessed
                ? `This analysis was produced from the actual media${
                    reel.analysisModel ? ` by ${reel.analysisModel}` : ""
                  }. Replies still require review before sending.`
                : mode === "live"
                  ? "Analysis starts only after the actual media is downloaded or uploaded. A caption or URL alone is never summarised."
                  : "Demo Reels use stored sample content. Upload a video to run analysis on real media bytes."}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/inbox?conversation=${reel.conversationId}`}
              onClick={onClose}
              className={buttonClasses("secondary", "md")}
            >
              <MessageSquare className="size-4" />
              Open conversation
            </Link>
            {needsUpload ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
                <Button onClick={() => fileRef.current?.click()} disabled={isUploading}>
                  {isUploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {isUploading ? "Uploading…" : "Upload video"}
                </Button>
              </>
            ) : state === "awaiting" || state === "analyzing" ? (
              <Button onClick={() => analyzeReel(reel.id)} disabled={state === "analyzing"}>
                {state === "analyzing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {state === "analyzing"
                  ? "Analyzing…"
                  : mode === "live"
                    ? "Analyze media"
                    : "Run demo analysis"}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-3">
          <ReelThumbnail reel={reel} size="lg" className="aspect-[4/5] w-full rounded-xl" />
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-1">
            <MetaRow
              icon={Clock3}
              label="Duration"
              value={reel.durationSec > 0 ? formatDuration(reel.durationSec) : "Unavailable"}
            />
            <MetaRow icon={Eye} label="Views" value={formatCompact(reel.views)} />
            <MetaRow icon={Heart} label="Likes" value={formatCompact(reel.likes)} />
            <MetaRow icon={AudioLines} label="Audio" value={reel.audio ?? "Unavailable"} />
            <MetaRow
              icon={ThumbsUp}
              label="Analyzed"
              value={state === "analyzed" ? "Yes" : state === "unavailable" ? "No" : "Pending"}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{mode === "live" ? "Instagram Reel" : "Demo Reel"}</Badge>
              {reel.accessible ? (
                <Badge variant="emerald" dot>
                  Media accessible
                </Badge>
              ) : (
                <Badge variant="rose" dot>
                  Media not accessible
                </Badge>
              )}
              {demoSeed && <Badge variant="amber">Pre-written demo</Badge>}
              {reel.mediaAccessed && <Badge variant="emerald">Media accessed</Badge>}
              {reel.analysisModel && <Badge variant="indigo">{reel.analysisModel}</Badge>}
            </div>
            <h3 className="font-display text-base leading-snug font-semibold text-white">
              {reel.accessible ? reel.caption : "Reel unavailable"}
            </h3>
          </div>

          {needsUpload && (
            <div className="space-y-3 rounded-xl border border-amber-300/15 bg-amber-400/[0.05] p-3 text-[11px] leading-relaxed text-amber-100/70">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300/80" />
                <p>
                  {reel.inaccessibleReason ??
                    "The backend cannot access this Reel's media through the official API."}
                  <span className="mt-1 block text-amber-100/45">
                    Analysis is skipped rather than guessed. If you own the rights to the video,
                    upload it below and the assistant will analyse the actual file.
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-300/25 bg-black/15 px-3 py-2.5 text-[11px] font-medium text-amber-100/80 transition hover:border-amber-300/45 hover:bg-black/25 disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileVideo className="size-3.5" />
                )}
                {isUploading
                  ? "Uploading and validating the file…"
                  : "Choose an MP4, MOV, WebM or image file"}
              </button>
            </div>
          )}

          {insight && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-violet-300" />
                <h4 className="text-[11px] font-semibold tracking-wide text-white/80 uppercase">
                  AI summary
                </h4>
                {demoSeed ? (
                  <DemoBadge label="Demo" className="ml-auto" />
                ) : (
                  <Badge variant="emerald" className="ml-auto">
                    From media
                  </Badge>
                )}
              </div>
              <p className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-[12px] leading-relaxed text-white/60">
                {insight.summary}
              </p>
            </div>
          )}

          {insight && insight.topics.length > 0 && (
            <div>
              <h4 className="mb-2 text-[11px] font-semibold tracking-wide text-white/45 uppercase">
                Detected topics
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {insight.topics.map((topic) => (
                  <Badge key={topic} variant="purple">
                    {topic}
                  </Badge>
                ))}
                {insight.sentiment && <Badge variant="indigo">Mood · {insight.sentiment}</Badge>}
              </div>
            </div>
          )}

          {reel.limitations && reel.limitations.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <h4 className="text-[10px] font-semibold tracking-wide text-white/45 uppercase">
                Analysis limitations
              </h4>
              <ul className="mt-1.5 space-y-1">
                {reel.limitations.map((limitation) => (
                  <li key={limitation} className="text-[10px] leading-relaxed text-white/35">
                    · {limitation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state === "awaiting" && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-4 text-center">
              <Play className="mx-auto mb-2 size-5 text-white/30" />
              <p className="text-xs font-medium text-white/65">Analysis not generated yet</p>
              <p className="mt-1 text-[10.5px] text-white/35">
                {mode === "live"
                  ? "Run analysis to process the actual media bytes."
                  : "Run the demo analysis to preview the intelligence panel."}
              </p>
            </div>
          )}

          {state === "analyzing" && (
            <div className="space-y-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
              <div className="flex items-center gap-2 text-xs text-violet-200">
                <Loader2 className="size-3.5 animate-spin" />
                {mode === "live" ? "Analyzing media…" : "Simulating Reel analysis…"}
              </div>
              <div className="skeleton h-2 w-full rounded-full" />
              <div className="skeleton h-2 w-4/5 rounded-full" />
              <div className="skeleton h-2 w-2/3 rounded-full" />
            </div>
          )}

          {insight && insight.suggestedReplies.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[11px] font-semibold tracking-wide text-white/45 uppercase">
                  Suggested responses
                </h4>
                <span className="text-[10px] text-white/25">Click to copy</span>
              </div>
              <ul className="space-y-2">
                {insight.suggestedReplies.map((reply) => (
                  <li key={reply.tone}>
                    <button
                      type="button"
                      onClick={() => copy(reply.text)}
                      className="group flex w-full items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]"
                    >
                      <Badge variant="neutral" className="mt-0.5 shrink-0">
                        {reply.tone}
                      </Badge>
                      <span className="flex-1 text-[11.5px] leading-relaxed text-white/65 group-hover:text-white/85">
                        {reply.text}
                      </span>
                      <Copy
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0 text-white/20 transition group-hover:text-violet-300",
                        )}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
