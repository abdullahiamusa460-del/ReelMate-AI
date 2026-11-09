import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-[0_10px_30px_-12px_rgba(124,58,237,0.9)] hover:brightness-110 active:brightness-95",
  secondary:
    "border border-white/10 bg-white/[0.055] text-white/90 hover:border-white/20 hover:bg-white/[0.09]",
  ghost: "text-white/65 hover:bg-white/[0.06] hover:text-white",
  danger: "border border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  subtle: "bg-violet-500/12 text-violet-200 border border-violet-400/20 hover:bg-violet-500/20",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-sm",
  icon: "size-9 rounded-lg",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
