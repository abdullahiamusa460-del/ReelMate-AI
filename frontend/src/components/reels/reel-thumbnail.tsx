import { Eye, Heart, LockKeyhole, Play } from "lucide-react";
import type { Reel } from "@/types";
import { cn } from "@/lib/cn";
import { formatCompact, formatDuration } from "@/lib/format";

export function ReelThumbnail({
  reel,
  className,
  size = "md",
  showStats = true,
  showBadge = true,
}: {
  reel: Reel;
  className?: string;
  size?: "sm" | "md" | "lg";
  showStats?: boolean;
  showBadge?: boolean;
}) {
  const [h1, h2] = reel.hues;
  const iconSize = size === "lg" ? "size-14" : size === "sm" ? "size-8" : "size-10";

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-ink-800",
        !reel.accessible && "grayscale-[0.65]",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(140deg, hsl(${h1} 68% 44%) 0%, hsl(${h2} 62% 28%) 55%, hsl(${h2} 55% 16%) 100%)`,
      }}
    >
      {/* Decorative frame content — generated gradients, not real video frames. */}
      <div className="absolute inset-0 grid-lines opacity-[0.22]" aria-hidden />
      <div
        aria-hidden
        className="absolute -top-10 -right-8 size-40 rounded-full border border-white/20"
      />
      <div
        aria-hidden
        className="absolute -right-14 top-1/2 size-48 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-16 -left-10 size-48 rounded-full border-[18px] border-white/[0.07]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" aria-hidden />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
        {showBadge ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/35 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur">
            <Play className="size-2.5 fill-current" />
            REEL
          </span>
        ) : (
          <span />
        )}
        {!reel.accessible && (
          <span className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/40 px-1.5 py-0.5 text-[9px] text-white/85 backdrop-blur">
            <LockKeyhole className="size-2.5" />
            Private
          </span>
        )}
      </div>

      <div className="absolute inset-0 grid place-items-center">
        {reel.accessible ? (
          <span
            className={cn(
              "grid place-items-center rounded-full border border-white/25 bg-black/30 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105",
              iconSize,
            )}
          >
            <Play className="ml-0.5 size-[38%] fill-current" />
          </span>
        ) : (
          <span className={cn("grid place-items-center rounded-full border border-white/15 bg-black/30 text-white/60", iconSize)}>
            <LockKeyhole className="size-[38%]" />
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-white/85">{reel.creator}</p>
          {showStats && (
            <div className="mt-0.5 flex items-center gap-2 text-[9px] text-white/60">
              {reel.views !== null && (
                <span className="inline-flex items-center gap-0.5">
                  <Eye className="size-2.5" />
                  {formatCompact(reel.views)}
                </span>
              )}
              {reel.likes !== null && (
                <span className="inline-flex items-center gap-0.5">
                  <Heart className="size-2.5" />
                  {formatCompact(reel.likes)}
                </span>
              )}
            </div>
          )}
        </div>
        {reel.accessible && reel.durationSec > 0 && (
          <span className="shrink-0 rounded bg-black/50 px-1.5 py-0.5 text-[9px] tabular-nums text-white/85">
            {formatDuration(reel.durationSec)}
          </span>
        )}
      </div>
    </div>
  );
}
