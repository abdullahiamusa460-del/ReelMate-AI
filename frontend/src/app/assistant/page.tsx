"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlignLeft,
  Ban,
  Briefcase,
  Check,
  Clock3,
  Gauge,
  Heart,
  HelpCircle,
  Info,
  Languages,
  LockKeyhole,
  MessageSquareText,
  Reply,
  Save,
  Settings2,
  ShieldAlert,
  Smile,
  Sparkles,
  Timer,
  ToggleRight,
  Wand2,
  X,
} from "lucide-react";
import type { AssistantSettings, Personality, ResponseLength, Tone } from "@/types";
import { DEMO_REELS } from "@/data";
import { useApp } from "@/components/providers/app-provider";
import { LANGUAGES, DEFAULT_SETTINGS } from "@/lib/defaults";
import { buildDemoReply } from "@/lib/draft";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusDot } from "@/components/ui/status-dot";
import { Toggle } from "@/components/ui/toggle";
import { ReelThumbnail } from "@/components/reels/reel-thumbnail";

const PERSONALITIES: {
  value: Personality;
  label: string;
  description: string;
  icon: typeof Smile;
}[] = [
  { value: "friendly", label: "Friendly", description: "Warm and approachable", icon: Smile },
  { value: "professional", label: "Professional", description: "Clear and polished", icon: Briefcase },
  { value: "witty", label: "Witty", description: "Playful, light humour", icon: Sparkles },
  { value: "supportive", label: "Supportive", description: "Encouraging and kind", icon: Heart },
  { value: "curious", label: "Curious", description: "Asks good follow-ups", icon: HelpCircle },
];

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "casual", label: "Casual", hint: "Relaxed language, contractions, short sentences." },
  { value: "balanced", label: "Balanced", hint: "Natural but measured — safe for most chats." },
  { value: "formal", label: "Formal", hint: "Polished, complete sentences, no slang." },
  { value: "enthusiastic", label: "Enthusiastic", hint: "High energy with expressive punctuation." },
];

const LENGTHS: { value: ResponseLength; label: string; example: string }[] = [
  { value: "short", label: "Short", example: "Love this! Count me in ✨" },
  { value: "medium", label: "Medium", example: "Love this — the design angle is great. Want to compare notes?" },
  {
    value: "detailed",
    label: "Detailed",
    example: "This looks genuinely useful, especially the practical parts. I'd be up for trying it — want to sort out a time?",
  },
];

function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: typeof Settings2;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/[0.09] text-violet-300">
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-3.5 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-white/80">{title}</p>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/35">{description}</p>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={title}
        size="sm"
        className="mt-0.5"
      />
    </div>
  );
}

function SampleChat({
  settings,
  live,
}: {
  settings: AssistantSettings;
  live?: boolean;
}) {
  const reply = buildDemoReply(settings, { topic: "Web design", hasReel: true });
  const reel = DEMO_REELS[0];
  const tone = TONES.find((item) => item.value === settings.tone);
  const personality = PERSONALITIES.find((item) => item.value === settings.personality);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <Avatar name="Maya Chen" hue={275} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-medium text-white/80">Maya Chen</p>
          <p className="text-[8.5px] text-white/30">
            {live ? "Preview conversation" : "Sample conversation"}
          </p>
        </div>
        {live ? (
          <Badge variant="emerald" dot>
            Live preview
          </Badge>
        ) : (
          <DemoBadge label="Demo" />
        )}
      </div>

      <div className="space-y-3 p-3">
        <div className="max-w-[90%] rounded-xl rounded-bl-sm border border-white/[0.06] bg-white/[0.05] px-2.5 py-2 text-[10.5px] leading-relaxed text-white/70">
          ok you NEED to see this
        </div>
        <div className="w-[78%] overflow-hidden rounded-lg border border-white/[0.08]">
          <ReelThumbnail reel={reel} size="sm" className="h-20 w-full" showStats={false} />
        </div>
        <div className="ml-auto max-w-[92%]">
          <span className="mb-1 flex items-center justify-end gap-1 text-[8.5px] text-violet-300/60">
            <Sparkles className="size-2.5" />
            Preview · not sent
          </span>
          <div className="rounded-xl rounded-br-sm border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.24] to-indigo-500/[0.14] px-2.5 py-2 text-[10.5px] leading-relaxed text-violet-50/90">
            {reply}
          </div>
          <p className="mt-1 text-right text-[8.5px] text-white/25">
            {personality?.label} · {tone?.label} · {settings.length}
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.06] p-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1.5">
          <LockKeyhole className="size-3 text-amber-200/50" />
          <span className="text-[9px] text-white/30">{live ? "Delivery through Instagram API" : "Delivery disabled — demo"}</span>
          <span className="ml-auto grid size-5 place-items-center rounded bg-violet-500/20 text-violet-200/50">
            <Reply className="size-2.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const {
    settings,
    ready,
    saveSettings,
    resetSettings,
    aiEnabled,
    mode,
    connection,
    backendAvailable,
    status,
  } = useApp();
  const [draft, setDraft] = useState<AssistantSettings>(settings);

  // Sync once local preferences are hydrated, and after save/reset.
  useEffect(() => {
    if (ready) setDraft(settings);
  }, [ready, settings]);

  const live = mode === "live";
  const deliveryEnabled = Boolean(status?.deliveryEnabled);
  const account = connection.accountHandle
    ? `@${connection.accountHandle.replace(/^@/, "")}`
    : null;

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const handleReset = () => {
    resetSettings();
    setDraft(DEFAULT_SETTINGS);
  };

  const update = <K extends keyof AssistantSettings>(key: K, value: AssistantSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const updateAuto = <K extends keyof AssistantSettings["autoReply"]>(
    key: K,
    value: AssistantSettings["autoReply"][K],
  ) =>
    setDraft((current) => ({
      ...current,
      autoReply: { ...current.autoReply, [key]: value },
    }));

  const updateQuiet = <K extends keyof AssistantSettings["autoReply"]["quietHours"]>(
    key: K,
    value: AssistantSettings["autoReply"]["quietHours"][K],
  ) =>
    setDraft((current) => ({
      ...current,
      autoReply: {
        ...current.autoReply,
        quietHours: { ...current.autoReply.quietHours, [key]: value },
      },
    }));

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="size-1.5 rounded-full bg-violet-400" />
            AI assistant settings
            <DemoBadge className="ml-1" />
          </>
        }
        title="Shape how your assistant replies"
        description={
          live
            ? "Tune personality, tone, language and automatic reply rules. Changes are stored by the backend and applied to generated replies and deliveries."
            : backendAvailable
              ? "Tune personality, tone, language and automatic reply rules. Changes are stored by the backend and applied to demo drafts and previews."
              : "Tune personality, tone, language and automatic reply rules in this local preview. Changes persist in the browser only until the backend is reachable."
        }
        actions={
          <>
            <Button variant="secondary" onClick={handleReset}>
              Reset
            </Button>
            <Button variant={dirty ? "primary" : "secondary"} onClick={() => saveSettings(draft)} disabled={!dirty}>
              {dirty ? <Save className="size-4" /> : <Check className="size-4" />}
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-white/40">
          <StatusDot tone={aiEnabled ? "emerald" : "slate"} pulse={aiEnabled} />
          Assistant {aiEnabled ? (live ? "ON — live" : "ON — demo") : "OFF"}
        </span>
        <span className="hidden h-3 w-px bg-white/10 sm:block" />
        <span className="text-[10px] text-white/30">
          {live
            ? `Settings applied to replies for ${account ?? "the connected account"}.`
            : backendAvailable
              ? "Settings applied to demo drafts and previews."
              : "Settings saved in the browser only until the backend is reachable."}
        </span>
        <Link
          href="/"
          className={buttonClasses("ghost", "sm", "ml-auto max-sm:hidden")}
        >
          Go to toggle
        </Link>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SettingsSection
            icon={Smile}
            title="Response personality"
            description="The overall character your assistant adopts in conversation."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PERSONALITIES.map((item) => {
                const Icon = item.icon;
                const active = draft.personality === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update("personality", item.value)}
                    className={cn(
                      "group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-200",
                      active
                        ? "border-violet-400/40 bg-gradient-to-br from-violet-500/[0.16] to-indigo-500/[0.05] shadow-[0_0_30px_-16px_rgba(139,92,246,0.9)]"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-lg border",
                          active
                            ? "border-violet-300/30 bg-violet-400/15 text-violet-200"
                            : "border-white/[0.08] text-white/40",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      {active && (
                        <span className="grid size-4 place-items-center rounded-full bg-violet-400 text-ink-950">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <p className={cn("text-[11.5px] font-medium", active ? "text-white" : "text-white/65")}>
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-[9.5px] leading-relaxed text-white/30">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingsSection>

          <SettingsSection
            icon={MessageSquareText}
            title="Voice & language"
            description="Control how replies sound and which language they use."
          >
            <div>
              <label className="mb-2 block text-[10.5px] font-medium text-white/55">
                Communication tone
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TONES.map((tone) => {
                  const active = draft.tone === tone.value;
                  return (
                    <button
                      key={tone.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update("tone", tone.value)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-[11px] font-medium transition",
                        active
                          ? "border-violet-400/35 bg-violet-500/[0.14] text-violet-100"
                          : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/15 hover:text-white/70",
                      )}
                    >
                      {tone.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[9.5px] text-white/30">
                <Info className="mt-0.5 size-2.5 shrink-0" />
                {TONES.find((tone) => tone.value === draft.tone)?.hint}
              </p>
            </div>

            <div className="mt-5">
              <label
                htmlFor="language-select"
                className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium text-white/55"
              >
                <Languages className="size-3.5" />
                Reply language
              </label>
              <select
                id="language-select"
                value={draft.language}
                onChange={(event) => update("language", event.target.value)}
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-white/80 focus:border-violet-400/40 focus:outline-none sm:max-w-xs"
              >
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[9.5px] text-white/25">
                A real integration would pass this preference to the reply generator.
              </p>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10.5px] font-medium text-white/55">
                  <AlignLeft className="size-3.5" />
                  Response length
                </label>
                <span className="text-[9px] text-white/25">Approximate, not enforced here</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {LENGTHS.map((length) => {
                  const active = draft.length === length.value;
                  return (
                    <button
                      key={length.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update("length", length.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        active
                          ? "border-violet-400/35 bg-violet-500/[0.09]"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-[11px] font-medium", active ? "text-violet-100" : "text-white/60")}>
                          {length.label}
                        </span>
                        <span
                          className={cn(
                            "size-3 rounded-full border",
                            active ? "border-violet-300 bg-violet-400" : "border-white/20",
                          )}
                        />
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[9.5px] leading-relaxed text-white/30">
                        {length.example}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3">
              <ToggleRow
                title="Include emoji"
                description="Add a light emoji touch when it fits the conversation."
                checked={draft.includeEmoji}
                onChange={(next) => update("includeEmoji", next)}
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="custom-instructions"
                className="mb-2 flex items-center justify-between text-[10.5px] font-medium text-white/55"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Wand2 className="size-3.5" />
                  Custom instructions
                </span>
                <span className="text-[9px] font-normal text-white/25">
                  {draft.customInstructions.length}/400
                </span>
              </label>
              <textarea
                id="custom-instructions"
                value={draft.customInstructions}
                onChange={(event) => update("customInstructions", event.target.value)}
                rows={3}
                maxLength={400}
                placeholder="e.g. Keep replies under three sentences. Mention that I prefer voice notes for long plans. Never promise a specific time without checking."
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-white/80 placeholder:text-white/20 focus:border-violet-400/40 focus:bg-white/[0.04] focus:outline-none"
              />
              <p className="mt-1.5 flex items-start gap-1.5 text-[9px] leading-relaxed text-white/25">
                <ShieldAlert className="mt-0.5 size-2.5 shrink-0" />
                Stored locally in this demo. Not transmitted to any AI provider.
              </p>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={ToggleRight}
            title="Automatic reply preferences"
            description="Decide which conversations the assistant may handle and when."
            action={
              <Badge variant="amber" className="shrink-0">
                <LockKeyhole className="size-2.5" />
                Delivery off
              </Badge>
            }
          >
            <div>
              <label className="mb-2 block text-[10.5px] font-medium text-white/55">
                When a reply is ready
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    value: "automatic" as const,
                    title: "Send automatically",
                    description:
                      "Send without asking — intended for approved, connected accounts. Blocked in this demo.",
                  },
                  {
                    value: "review" as const,
                    title: "Review first",
                    description:
                      "Hold every draft for your approval before it would be sent.",
                  },
                ].map((mode) => {
                  const active = draft.autoReply.sendMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updateAuto("sendMode", mode.value)}
                      className={cn(
                        "flex gap-3 rounded-xl border p-3.5 text-left transition",
                        active
                          ? "border-violet-400/35 bg-violet-500/[0.08]"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                          active ? "border-violet-300 bg-violet-400/90" : "border-white/25",
                        )}
                      >
                        {active && <span className="size-1.5 rounded-full bg-ink-950" />}
                      </span>
                      <span>
                        <span className={cn("block text-[11.5px] font-medium", active ? "text-white" : "text-white/65")}>
                          {mode.title}
                        </span>
                        <span className="mt-0.5 block text-[9.5px] leading-relaxed text-white/30">
                          {mode.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3">
              <ToggleRow
                title="Only reply when a Reel is shared"
                description="Skip conversations without Reel content."
                checked={draft.autoReply.onlyWithReels}
                onChange={(next) => updateAuto("onlyWithReels", next)}
              />
              <ToggleRow
                title="Skip message requests"
                description="Do not reply to people you don't follow."
                checked={draft.autoReply.skipMessageRequests}
                onChange={(next) => updateAuto("skipMessageRequests", next)}
              />
              <ToggleRow
                title="Skip group chats"
                description="Limit handling to one-to-one conversations."
                checked={draft.autoReply.skipGroupChats}
                onChange={(next) => updateAuto("skipGroupChats", next)}
              />
              <ToggleRow
                title="Pause on sensitive topics"
                description="Hold the draft for review if the conversation becomes sensitive."
                checked={draft.autoReply.pauseForSensitiveTopics}
                onChange={(next) => updateAuto("pauseForSensitiveTopics", next)}
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="reply-delay" className="flex items-center gap-1.5 text-[10.5px] font-medium text-white/55">
                    <Timer className="size-3.5" />
                    Reply delay
                  </label>
                  <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/55">
                    {draft.autoReply.replyDelaySec}s
                  </span>
                </div>
                <input
                  id="reply-delay"
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={draft.autoReply.replyDelaySec}
                  onChange={(event) => updateAuto("replyDelaySec", Number(event.target.value))}
                />
                <div className="mt-1.5 flex justify-between text-[8.5px] text-white/20">
                  <span>5s</span>
                  <span>2 min</span>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="max-per-hour" className="flex items-center gap-1.5 text-[10.5px] font-medium text-white/55">
                    <Gauge className="size-3.5" />
                    Max replies per hour
                  </label>
                  <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/55">
                    {draft.autoReply.maxPerHour}
                  </span>
                </div>
                <input
                  id="max-per-hour"
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={draft.autoReply.maxPerHour}
                  onChange={(event) => updateAuto("maxPerHour", Number(event.target.value))}
                />
                <div className="mt-1.5 flex justify-between text-[8.5px] text-white/20">
                  <span>5</span>
                  <span>60</span>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3">
              <ToggleRow
                title="Quiet hours"
                description="Pause automatic handling during a chosen window."
                checked={draft.autoReply.quietHours.enabled}
                onChange={(next) => updateQuiet("enabled", next)}
              />
              <div className="flex items-center gap-2 py-3">
                <span className="flex-1 text-[10px] text-white/35">
                  {draft.autoReply.quietHours.enabled
                    ? "Replies pause between these times."
                    : "Enable quiet hours to choose a window."}
                </span>
                <input
                  type="time"
                  aria-label="Quiet hours start"
                  value={draft.autoReply.quietHours.start}
                  disabled={!draft.autoReply.quietHours.enabled}
                  onChange={(event) => updateQuiet("start", event.target.value)}
                  className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[10px] text-white/60 disabled:opacity-35 focus:border-violet-400/40 focus:outline-none"
                />
                <span className="text-[10px] text-white/25">to</span>
                <input
                  type="time"
                  aria-label="Quiet hours end"
                  value={draft.autoReply.quietHours.end}
                  disabled={!draft.autoReply.quietHours.enabled}
                  onChange={(event) => updateQuiet("end", event.target.value)}
                  className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-[10px] text-white/60 disabled:opacity-35 focus:border-violet-400/40 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="exclude-keywords" className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium text-white/55">
                <Ban className="size-3.5" />
                Never reply to these keywords
              </label>
              <input
                id="exclude-keywords"
                type="text"
                value={draft.autoReply.excludeKeywords}
                onChange={(event) => updateAuto("excludeKeywords", event.target.value)}
                placeholder="e.g. refund, invoice, unsubscribe"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] text-white/80 placeholder:text-white/20 focus:border-violet-400/40 focus:outline-none"
              />
              <p className="mt-1.5 text-[9px] text-white/25">
                Comma-separated. Matching is handled by a backend in a real deployment.
              </p>
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-300/15 bg-amber-400/[0.045] p-3">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-amber-300/70" />
              <p className="text-[10px] leading-relaxed text-amber-100/55">
                Automatic sending is a preference only in this frontend. No Instagram account is
                connected and no reply is ever delivered.{" "}
                <Link href="/connection" className="font-medium text-amber-100/80 underline decoration-amber-300/30 underline-offset-2 hover:text-amber-50">
                  See connection requirements
                </Link>
                .
              </p>
            </div>
          </SettingsSection>

          <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[10px] text-white/35">
              <Clock3 className="size-3.5 shrink-0" />
              {dirty ? "You have unsaved changes." : "All changes saved in this browser."}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Restore defaults
              </Button>
              <Button
                size="sm"
                variant={dirty ? "primary" : "secondary"}
                onClick={() => saveSettings(draft)}
                disabled={!dirty}
              >
                <Save className="size-3.5" />
                Save changes
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-violet-300" />
                <h2 className="font-display text-xs font-semibold text-white">Live preview</h2>
              </div>
              {live ? (
                <Badge variant="emerald" dot>
                  Live reply preview
                </Badge>
              ) : (
                <DemoBadge label="Demo" />
              )}
            </div>
            <p className="mt-1 text-[9.5px] leading-relaxed text-white/30">
              Updates as you change settings on this page.
            </p>
            <div className="mt-3">
              <SampleChat settings={draft} live={live} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="purple">{draft.personality}</Badge>
              <Badge variant="indigo">{draft.tone}</Badge>
              <Badge variant="neutral">{draft.length}</Badge>
              <Badge variant="neutral">{draft.includeEmoji ? "Emoji on" : "No emoji"}</Badge>
            </div>

            <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3 text-[9.5px]">
              <div className="flex items-center justify-between">
                <span className="text-white/30">Language</span>
                <span className="text-white/60">{draft.language}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/30">Send mode</span>
                <span className="text-white/60">
                  {draft.autoReply.sendMode === "automatic" ? "Automatic" : "Review first"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/30">Reel required</span>
                <span className="text-white/60">
                  {draft.autoReply.onlyWithReels ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/30">Delivery</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    deliveryEnabled ? "text-emerald-300/70" : "text-rose-300/70",
                  )}
                >
                  {deliveryEnabled ? (
                    <>
                      <Check className="size-2.5" />
                      Enabled
                    </>
                  ) : live ? (
                    <>
                      <LockKeyhole className="size-2.5" />
                      Held as draft
                    </>
                  ) : (
                    <>
                      <LockKeyhole className="size-2.5" />
                      Demo only
                    </>
                  )}
                </span>
              </div>
            </div>

            {draft.language !== "Match sender's language" && draft.language !== "English" && (
              <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-[9px] leading-relaxed text-white/30">
                The preview stays in English. Language selection is saved, but no translation
                model is part of this frontend demo.
              </p>
            )}

            <p className="mt-3 flex items-start gap-1.5 text-[8.5px] leading-relaxed text-white/20">
              <Info className="mt-0.5 size-2.5 shrink-0" />
              Pre-written template generated locally from your sample settings. No AI model is
              called.
            </p>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-3.5 text-amber-300/60" />
              <h3 className="text-[10.5px] font-semibold text-white/75">
                {live ? "Still not implemented in this demo" : "What is not implemented"}
              </h3>
            </div>
            <ul className="mt-2 space-y-1.5">
              {[
                live
                  ? "Personal accounts — Meta's official messaging API requires Business or Creator accounts"
                  : "Instagram OAuth or webhooks — not available in this frontend preview",
                live
                  ? null
                  : "Message receiving or sending — handled by the backend; the frontend only calls it",
                live ? null : "AI model inference — provided by the backend's AI providers",
                live ? null : "Server-side persistence — provided by the backend database",
              ]
                .filter(Boolean)
                .map((item, index) => (
                  <li key={index} className="flex items-center gap-1.5 text-[9.5px] text-white/35">
                    <X className="size-2.5 shrink-0 text-rose-300/50" />
                    {item}
                  </li>
                ))}
            </ul>
            <Link
              href="/connection"
              className="mt-3 inline-flex items-center gap-1 text-[9.5px] font-medium text-violet-300/75 transition hover:text-violet-200"
            >
              {live ? "Manage connection" : "View setup requirements"}
              <Settings2 className="size-3" />
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}
