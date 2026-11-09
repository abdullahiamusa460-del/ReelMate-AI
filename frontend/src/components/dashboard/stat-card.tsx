import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  series,
  hint,
  accent = "violet",
}: {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  series?: number[];
  hint: string;
  accent?: "violet" | "indigo" | "emerald" | "sky";
}) {
  const max = Math.max(...(series ?? []), 1);
  const tone = {
    violet: "text-violet-300 border-violet-400/20 bg-violet-500/10",
    indigo: "text-indigo-300 border-indigo-400/20 bg-indigo-500/10",
    emerald: "text-emerald-300 border-emerald-400/20 bg-emerald-500/10",
    sky: "text-sky-300 border-sky-400/20 bg-sky-500/10",
  }[accent];
  const bar = {
    violet: "from-violet-400/80 to-violet-500/20",
    indigo: "from-indigo-400/80 to-indigo-500/20",
    emerald: "from-emerald-400/80 to-emerald-500/20",
    sky: "from-sky-400/80 to-sky-500/20",
  }[accent];

  return (
    <Panel className="group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.13]">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid size-9 place-items-center rounded-xl border", tone)}>
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              delta > 0
                ? "border-emerald-400/15 bg-emerald-500/[0.07] text-emerald-300/90"
                : delta < 0
                  ? "border-rose-400/15 bg-rose-500/[0.07] text-rose-300/90"
                  : "border-white/10 bg-white/[0.03] text-white/40",
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="size-3" />
            ) : delta < 0 ? (
              <ArrowDownRight className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-[26px] leading-none font-semibold tracking-tight text-white tabular-nums">
            {value}
          </p>
          <p className="mt-2 text-[11px] font-medium text-white/55">{label}</p>
        </div>
        {series && series.length > 0 && (
          <div
            className="flex h-10 w-[74px] shrink-0 items-end gap-[3px] opacity-70 transition group-hover:opacity-100"
            aria-hidden
          >
            {series.map((point, index) => (
              <span
                key={`${label}-${index}`}
                className={cn(
                  "flex-1 rounded-t-[2px] bg-gradient-to-t transition-all duration-500",
                  bar,
                )}
                style={{ height: `${Math.max(12, (point / max) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 border-t border-white/[0.05] pt-2.5 text-[10px] text-white/30">{hint}</p>
    </Panel>
  );
}
