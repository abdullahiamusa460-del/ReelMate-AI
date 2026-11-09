import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-violet-500/25 blur-xl" />
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Icon className="size-6 text-violet-300" strokeWidth={1.7} />
        </div>
      </div>
      <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-white/45">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
