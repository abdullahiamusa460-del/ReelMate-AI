"use client";

import { useMemo, useState } from "react";
import {
  Film,
  Loader2,
  LockKeyhole,
  Search,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useSimulatedLoading } from "@/lib/useSimulatedLoading";
import { cn } from "@/lib/cn";
import { getReelState, type ReelState } from "@/lib/reel";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/ui/demo-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ReelCard } from "@/components/reels/reel-card";
import { ReelDetailModal } from "@/components/reels/reel-detail-modal";

type ReelFilter = "all" | ReelState;

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Film;
  tone: string;
}) {
  return (
    <div className="panel flex items-center gap-2.5 px-3 py-2.5">
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", tone)}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-sm leading-none font-semibold text-white tabular-nums">
          {value}
        </p>
        <p className="mt-1 truncate text-[9px] text-white/35">{label}</p>
      </div>
    </div>
  );
}

export default function ReelsPage() {
  const simulated = useSimulatedLoading(650);
  const { analyses, analyzing, analyzeReel, reels, ready, mode } = useApp();
  const loading = simulated || !ready;
  const [filter, setFilter] = useState<ReelFilter>("all");
  const [query, setQuery] = useState("");
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const activeReel = activeReelId
    ? reels.find((reel) => reel.id === activeReelId) ?? null
    : null;

  const states = useMemo(
    () =>
      Object.fromEntries(
        reels.map((reel) => [reel.id, getReelState(reel, analyses, analyzing)]),
      ) as Record<string, ReelState>,
    [analyses, analyzing, reels],
  );

  const counts = useMemo(() => {
    const values = Object.values(states);
    return {
      all: reels.length,
      analyzed: values.filter((state) => state === "analyzed").length,
      awaiting: values.filter((state) => state === "awaiting" || state === "analyzing").length,
      unavailable: values.filter((state) => state === "unavailable").length,
    };
  }, [reels.length, states]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reels.filter((reel) => {
      if (filter === "analyzing" || filter === "awaiting") {
        if (states[reel.id] !== "awaiting" && states[reel.id] !== "analyzing") return false;
      } else if (filter !== "all" && states[reel.id] !== filter) {
        return false;
      }
      if (!normalized) return true;
      return [reel.caption, reel.creator, reel.sharedBy, ...reel.topics]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, query, reels, states]);

  const pending = reels.filter(
    (reel) => states[reel.id] === "awaiting" && reel.accessible,
  );

  const runPending = () => {
    pending.forEach((reel, index) => {
      window.setTimeout(() => analyzeReel(reel.id), index * 450);
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="size-1.5 rounded-full bg-violet-400" />
            Reel Intelligence
            {mode === "live" ? (
              <Badge variant="emerald" dot className="ml-1">
                Live
              </Badge>
            ) : (
              <DemoBadge className="ml-1" />
            )}
          </>
        }
        title="Shared Reels, understood"
        description={
          mode === "live"
            ? "Analyze Reels only after their actual media is accessible, then use the result to ground a contextual reply."
            : "Preview how ReelMate AI summarizes stored sample Reels, detects topics, and suggests context-aware responses."
        }
        actions={
          <>
            <Badge variant="purple" className="max-sm:hidden">
              <Sparkles className="size-3" />
              {counts.analyzed} analyzed
            </Badge>
            {pending.length > 0 && (
              <button
                type="button"
                onClick={runPending}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/[0.12] px-4 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
              >
                <Wand2 className="size-4" />
                {mode === "live" ? "Analyze pending" : "Run demo analysis"}
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          label={mode === "live" ? "Total Reels" : "Total demo Reels"}
          value={counts.all}
          icon={Film}
          tone="border-violet-400/20 bg-violet-500/10 text-violet-300"
        />
        <MiniStat
          label="Analyzed"
          value={counts.analyzed}
          icon={Sparkles}
          tone="border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
        />
        <MiniStat
          label="Awaiting analysis"
          value={counts.awaiting}
          icon={Loader2}
          tone="border-amber-400/20 bg-amber-500/10 text-amber-300"
        />
        <MiniStat
          label="Restricted content"
          value={counts.unavailable}
          icon={LockKeyhole}
          tone="border-rose-400/20 bg-rose-500/10 text-rose-300"
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Filter Reels"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "analyzed", label: "Analyzed", count: counts.analyzed },
            { value: "awaiting", label: "Awaiting", count: counts.awaiting },
            { value: "unavailable", label: "Restricted", count: counts.unavailable },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search captions or topics…"
            aria-label="Search Reels"
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pr-3 pl-8 text-xs text-white/85 placeholder:text-white/25 focus:border-violet-400/40 focus:bg-white/[0.05] focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={Search}
            title="No Reels match this view"
            description={
              reels.length === 0
                ? "No Reels have been shared in this workspace yet."
                : "Try another filter or search term."
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((reel) => (
            <ReelCard key={reel.id} reel={reel} onOpen={(r) => setActiveReelId(r.id)} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/12 bg-amber-400/[0.035] p-3">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-300/60" />
        <p className="text-[10px] leading-relaxed text-amber-100/45">
          {mode === "live"
            ? "Analysis only starts after the backend accesses the real media or you upload it. Thumbnails are generated gradients, not video frames. Restricted Reels are skipped rather than guessed at."
            : "Thumbnails are generated gradients, not video frames. Captions, summaries, topics and suggested replies are demos. Restricted Reels can be analysed only after you upload the video."}
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
