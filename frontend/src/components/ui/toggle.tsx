"use client";

import { cn } from "@/lib/cn";

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  size = "md",
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const track = size === "lg" ? "h-9 w-16" : size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob =
    size === "lg"
      ? "size-7 data-[on=true]:translate-x-7"
      : size === "sm"
        ? "size-3.5 data-[on=true]:translate-x-4"
        : "size-4.5 data-[on=true]:translate-x-5";
  const pad = size === "lg" ? "p-1" : size === "sm" ? "p-[3px]" : "p-1";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50",
        pad,
        track,
        checked
          ? "border-violet-300/30 bg-brand shadow-[0_0_24px_-4px_rgba(139,92,246,0.65)]"
          : "border-white/10 bg-white/10",
        className,
      )}
    >
      <span
        data-on={checked}
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out",
          knob,
        )}
      />
    </button>
  );
}
