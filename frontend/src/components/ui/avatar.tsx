import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const SIZES = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
} as const;

export function Avatar({
  name,
  hue,
  size = "md",
  ring = false,
  className,
}: {
  name: string;
  hue: number;
  size?: keyof typeof SIZES;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white/95 shadow-inner",
        SIZES[size],
        ring && "ring-2 ring-violet-400/70 ring-offset-2 ring-offset-ink-900",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 72% 58%), hsl(${(hue + 48) % 360} 68% 38%))`,
      }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
      <span className="relative">{initials(name)}</span>
    </span>
  );
}
