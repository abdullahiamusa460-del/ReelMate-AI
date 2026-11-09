"use client";

import { ArrowUpRight, TrendingUp } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Panel, PanelHeader } from "@/components/ui/panel";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ActivityChart() {
  const { stats, mode } = useApp();
  const weekly = stats.weekly.length ? stats.weekly : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...weekly, 1);
  const total = weekly.reduce((sum, value) => sum + value, 0);
  const average = Math.round(total / weekly.length);

  return (
    <Panel className="flex h-full flex-col p-5 sm:p-6">
      <PanelHeader
        title="Message volume"
        description={
          mode === "live"
            ? "Incoming messages received by the backend over the last 7 days"
            : "Stored demo messages over the last 7 days"
        }
        action={
          <div className="flex items-center gap-2">
            {mode === "live" ? (
              <Badge variant="emerald" dot>
                Live
              </Badge>
            ) : (
              <DemoBadge label="Sample" />
            )}
            <span className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-white/40">
              Last 7 days
            </span>
          </div>
        }
      />

      <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="font-display text-2xl leading-none font-semibold tracking-tight text-white tabular-nums">
            {formatNumber(total)}
          </p>
          <p className="mt-1.5 text-[10.5px] text-white/35">messages received</p>
        </div>
        <div className="flex items-center gap-4 text-[10.5px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-500/[0.06] px-2 py-0.5 text-emerald-300/90">
            <ArrowUpRight className="size-3" />
            {stats.deltas.messages}% vs. prior week
          </span>
          <span className="text-white/35">Avg. {average}/day</span>
        </div>
      </div>

      <div className="relative mt-6 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between" aria-hidden>
          {[0, 1, 2, 3].map((line) => (
            <span key={line} className="h-px w-full bg-white/[0.045]" />
          ))}
        </div>

        <div className="relative flex h-40 items-end gap-2 sm:gap-3">
          {weekly.map((value, index) => (
            <div key={DAYS[index]} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-[10px] whitespace-nowrap text-white/80 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                {value} messages
              </div>
              <div className="relative w-full overflow-hidden rounded-t-md bg-white/[0.025]" style={{ height: "100%" }}>
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-md bg-gradient-to-t from-indigo-600/35 via-violet-500/70 to-violet-300/90 transition-all duration-500 group-hover:from-indigo-500/55 group-hover:to-violet-200"
                  style={{ height: `${(value / max) * 100}%` }}
                />
                <div
                  className="absolute inset-x-0 rounded-t-md bg-violet-300/0 transition-colors group-hover:bg-violet-300/10"
                  style={{ bottom: `${(value / max) * 100}%`, height: `${100 - (value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-2 sm:gap-3">
          {DAYS.map((day, index) => (
            <span
              key={day}
              className={`flex-1 text-center text-[10px] ${
                index === DAYS.length - 1 ? "font-medium text-violet-300/90" : "text-white/30"
              }`}
            >
              {day}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-3 text-[10.5px] text-white/35">
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-violet-400" />
          Messages received
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          <TrendingUp className="size-3 text-emerald-300/70" />
          Peak day: {max}
        </span>
      </div>
    </Panel>
  );
}
