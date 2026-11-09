import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn("group flex items-center gap-2.5 rounded-xl outline-offset-4", className)}
      aria-label="ReelMate AI — dashboard"
    >
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-brand shadow-[0_8px_24px_-8px_rgba(124,58,237,0.9)]">
        <span className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%)]" />
        <Sparkles className="relative size-4 text-white" strokeWidth={2.2} />
      </span>
      {!compact && (
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-[15px] leading-none font-semibold tracking-tight text-white">
            ReelMate <span className="text-gradient">AI</span>
          </span>
          <span className="mt-1 text-[10px] leading-none tracking-wide text-white/35">
            Instagram messaging assistant
          </span>
        </span>
      )}
    </Link>
  );
}
