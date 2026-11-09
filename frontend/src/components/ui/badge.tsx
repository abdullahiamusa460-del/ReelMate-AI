import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant =
  | "purple"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "neutral"
  | "outline";

const VARIANTS: Record<BadgeVariant, string> = {
  purple: "border-violet-400/25 bg-violet-500/12 text-violet-200",
  indigo: "border-indigo-400/25 bg-indigo-500/12 text-indigo-200",
  emerald: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  rose: "border-rose-400/25 bg-rose-500/10 text-rose-200",
  neutral: "border-white/10 bg-white/[0.05] text-white/60",
  outline: "border-white/12 bg-transparent text-white/55",
};

export function Badge({
  children,
  variant = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        VARIANTS[variant],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
