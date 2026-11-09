import { cn } from "@/lib/cn";

export type DotTone = "emerald" | "amber" | "rose" | "violet" | "slate";

const TONES: Record<DotTone, { dot: string; ping: string }> = {
  emerald: { dot: "bg-emerald-400", ping: "bg-emerald-400/50" },
  amber: { dot: "bg-amber-300", ping: "bg-amber-300/50" },
  rose: { dot: "bg-rose-400", ping: "bg-rose-400/50" },
  violet: { dot: "bg-violet-400", ping: "bg-violet-400/50" },
  slate: { dot: "bg-white/35", ping: "bg-white/20" },
};

export function StatusDot({
  tone = "emerald",
  pulse = false,
  className,
}: {
  tone?: DotTone;
  pulse?: boolean;
  className?: string;
}) {
  const styles = TONES[tone];
  return (
    <span className={cn("relative flex size-2", className)} aria-hidden>
      {pulse && (
        <span
          className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", styles.ping)}
        />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", styles.dot)} />
    </span>
  );
}
