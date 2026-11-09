"use client";

import Link from "next/link";
import {
  ArrowRight,
  Film,
  Inbox,
  LockKeyhole,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusDot } from "@/components/ui/status-dot";

export function WorkflowCard() {
  const { aiEnabled, mode, status } = useApp();
  const live = mode === "live";
  const delivery = Boolean(status?.deliveryEnabled);
  const receive = Boolean(status?.receiveEnabled);
  const aiConfigured = Boolean(status?.ai.configured);

  const steps = [
    {
      icon: Inbox,
      title: "Receive an eligible message",
      description: "A DM that passes your request, keyword and rate-limit filters.",
      tag: receive ? "Webhook active" : live ? "Webhook pending" : "Demo data",
      tagTone: receive ? ("emerald" as const) : live ? ("amber" as const) : ("purple" as const),
    },
    {
      icon: Film,
      title: "Access the shared Reel",
      description: "Only Reels the authorized account can legitimately access.",
      tag: live ? "Access-controlled" : "Sample Reels",
      tagTone: live ? ("neutral" as const) : ("purple" as const),
    },
    {
      icon: Sparkles,
      title: "Analyze the Reel",
      description: "Summaries, topics and context from the actual media bytes.",
      tag: aiConfigured ? (live ? "Model ready" : "Model ready") : "Template fallback",
      tagTone: aiConfigured ? ("emerald" as const) : ("amber" as const),
    },
    {
      icon: Wand2,
      title: "Draft a contextual reply",
      description: "Uses your personality, tone, language and length settings.",
      tag: aiConfigured ? "AI or template" : "Template",
      tagTone: aiConfigured ? ("purple" as const) : ("neutral" as const),
    },
    {
      icon: Send,
      title: "Send via Instagram",
      description: delivery
        ? "Instagram accepted delivery through the official Messaging API."
        : live
          ? "Messaging permission is not confirmed, so replies are held as drafts."
          : "Demo mode stores replies locally and never claims delivery.",
      tag: delivery ? "Delivery enabled" : live ? "Held as draft" : "Not sent",
      tagTone: delivery ? ("emerald" as const) : ("amber" as const),
    },
  ];

  return (
    <Panel className="flex h-full flex-col p-5 sm:p-6">
      <PanelHeader
        title="Intended workflow"
        description={
          live
            ? "What happens when the assistant is ON for the connected account"
            : "What happens in demo mode and what a live account would add"
        }
        action={
          <Badge variant={aiEnabled ? "emerald" : "neutral"} dot>
            {aiEnabled ? (live ? "Live" : "Demo") : "Paused"}
          </Badge>
        }
      />

      <ol className="mt-5 flex-1 space-y-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          return (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-9 left-[15px] h-[calc(100%-1.75rem)] w-px",
                    aiEnabled ? "bg-gradient-to-b from-violet-400/30 to-white/[0.05]" : "bg-white/[0.06]",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border text-[11px] transition-colors",
                  aiEnabled
                    ? isLast && !delivery
                      ? "border-rose-400/20 bg-rose-500/[0.06] text-rose-300/80"
                      : "border-violet-400/25 bg-violet-500/[0.09] text-violet-200"
                    : "border-white/[0.08] bg-white/[0.025] text-white/30",
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.8} />
                {isLast && aiEnabled && !delivery && (
                  <LockKeyhole className="absolute -right-1 -bottom-1 size-2.5 text-rose-300/80" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "text-[11.5px] leading-snug font-medium",
                      aiEnabled ? "text-white/85" : "text-white/45",
                    )}
                  >
                    {step.title}
                  </p>
                  <Badge variant={step.tagTone} className="shrink-0 text-[9px]">
                    {step.tag}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-white/30">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
        <p className="flex items-center gap-2 text-[10px] text-white/30">
          <StatusDot tone={aiEnabled ? (delivery ? "emerald" : "amber") : "slate"} pulse={aiEnabled} />
          {aiEnabled
            ? delivery
              ? "Assistant active — Instagram delivery is enabled for this account."
              : live
                ? "Assistant active — replies are held as drafts until messaging permission is confirmed."
                : "Demo enabled — replies are stored locally and never delivered."
            : "Turn the assistant on to start processing eligible conversations."}
        </p>
        <Link
          href="/connection"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-300/80 transition hover:text-violet-200"
        >
          View integration requirements
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </Panel>
  );
}
