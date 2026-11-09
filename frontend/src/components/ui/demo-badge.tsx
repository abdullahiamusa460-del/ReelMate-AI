import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

/** Marks data or UI that is simulated, as opposed to a real Instagram connection. */
export function DemoBadge({ className, label = "Demo data" }: { className?: string; label?: string }) {
  return (
    <span
      title="Fictional sample content — not fetched from Instagram"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-amber-200/90",
        className,
      )}
    >
      <Sparkles className="size-3" />
      {label}
    </span>
  );
}

export function DemoRibbon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-amber-300/15 bg-amber-400/[0.05] px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-100/70",
        className,
      )}
    >
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-amber-300/80" />
      <p>
        <span className="font-medium text-amber-100/90">Demo preview.</span> All conversations,
        Reels and metrics are fictional sample data. Nothing is connected to Instagram and no
        replies are sent.
      </p>
    </div>
  );
}
