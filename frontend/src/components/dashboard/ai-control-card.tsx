"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CircleSlash2,
  Settings2,
  ShieldAlert,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatusDot } from "@/components/ui/status-dot";
import { Toggle } from "@/components/ui/toggle";
import { InstagramIcon } from "@/components/icons/instagram";

export function AiOrb({ active, size = "md" }: { active: boolean; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-20" : size === "sm" ? "size-11" : "size-14";
  const icon = size === "lg" ? "size-8" : size === "sm" ? "size-5" : "size-6";

  return (
    <div className={cn("relative grid place-items-center", box)}>
      {active && (
        <>
          <span className="absolute inset-0 rounded-full bg-violet-500/25 blur-xl" />
          <span className="absolute inset-0 animate-pulse-ring rounded-full border border-violet-400/30" />
        </>
      )}
      <div
        className={cn(
          "relative grid size-full place-items-center rounded-full border transition-all duration-500",
          active
            ? "border-violet-300/40 bg-brand shadow-[0_0_45px_-8px_rgba(139,92,246,0.75)]"
            : "border-white/10 bg-white/[0.05]",
        )}
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_55%)]" />
        <Sparkles
          className={cn("relative", icon, active ? "text-white" : "text-white/35")}
          strokeWidth={1.8}
        />
      </div>
    </div>
  );
}

export function AiControlCard() {
  const { aiEnabled, setAiEnabled, settings, mode, status, connection, backendAvailable } =
    useApp();
  const live = mode === "live";
  const delivery = Boolean(status?.deliveryEnabled);
  const account = connection.accountHandle
    ? `@${connection.accountHandle.replace(/^@/, "")}`
    : null;

  return (
    <Panel
      className={cn(
        "relative overflow-hidden p-5 transition-all duration-500 sm:p-6",
        aiEnabled
          ? "border-violet-400/20 shadow-[0_30px_90px_-50px_rgba(124,58,237,0.9)]"
          : "border-white/[0.07]",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          aiEnabled ? "opacity-100" : "opacity-40",
        )}
      >
        <div className="absolute -top-32 right-0 size-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 size-72 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/40 to-transparent" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <AiOrb active={aiEnabled} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold tracking-tight text-white">
                AI Assistant
              </h2>
              <Badge variant={aiEnabled ? "emerald" : "neutral"} dot>
                {aiEnabled ? "ON" : "OFF"}
              </Badge>
              {live ? (
                <Badge variant="emerald">Live mode</Badge>
              ) : (
                <Badge variant="amber">Demo mode</Badge>
              )}
            </div>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-white/50">
              {aiEnabled
                ? live
                  ? delivery
                    ? `Listening for eligible messages as ${account ?? "the connected account"}. Replies are generated from your settings and may be delivered through Instagram.`
                    : "Listening for eligible messages, but messaging permission is not confirmed. Replies are held as drafts and never claimed as delivered."
                  : "Listening for eligible demo messages. Replies are generated from stored sample data and clearly labelled as not delivered."
                : "Your assistant is paused. No messages are being processed and no replies are generated."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]",
                  live
                    ? "border-emerald-400/15 bg-emerald-500/[0.06] text-emerald-200/80"
                    : "border-rose-400/15 bg-rose-500/[0.06] text-rose-200/80",
                )}
              >
                {live ? <InstagramIcon className="size-3" /> : <WifiOff className="size-3" />}
                {live ? `${account ?? "Instagram"} connected` : "No Instagram account connected"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white/45">
                <ShieldAlert className="size-3" />
                {delivery ? "Instagram delivery enabled" : "Delivery blocked — drafts only"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-white/45">
                <Bot className="size-3" />
                {settings.autoReply.sendMode === "automatic" ? "Auto-send preference" : "Review before send"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3.5 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:min-w-[230px] lg:flex-col lg:items-stretch">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <div>
              <p className="text-[10px] tracking-[0.16em] text-white/35 uppercase">AI power</p>
              <p className={cn("mt-0.5 text-sm font-medium", aiEnabled ? "text-emerald-200" : "text-white/60")}>
                {aiEnabled ? (live ? "Active" : "Active (demo)") : "Paused"}
              </p>
            </div>
            <Toggle
              checked={aiEnabled}
              onChange={setAiEnabled}
              label="Enable AI assistant"
              size="lg"
              className="ml-auto sm:ml-3"
            />
          </div>
          <div className="flex gap-1.5 border-t border-white/[0.06] pt-3 sm:border-t-0 sm:pt-0 lg:border-t lg:pt-3">
            <Link href="/assistant" className={buttonClasses("secondary", "sm", "flex-1")}>
              <Settings2 className="size-3.5" />
              Configure
            </Link>
            <Link href="/connection" className={buttonClasses("ghost", "sm", "flex-1")}>
              <InstagramIcon className="size-3.5" />
              Connect
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.06] pt-4">
        <span className="flex items-center gap-2 text-[10.5px] text-white/40">
          <StatusDot tone={aiEnabled ? "emerald" : "slate"} pulse={aiEnabled} />
          {aiEnabled
            ? live
              ? "Waiting for eligible messages"
              : "Waiting for eligible demo messages"
            : "Processing stopped"}
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-white/30">
          <CircleSlash2 className="size-3" />
          {backendAvailable
            ? live
              ? "Connected through Meta's official Instagram API"
              : "Demo workspace — no Instagram message is sent or received"
            : "Backend unreachable — showing a local preview only"}
        </span>
      </div>
    </Panel>
  );
}
