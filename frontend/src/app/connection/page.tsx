"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleX,
  Copy,
  ExternalLink,
  Film,
  Gauge,
  KeyRound,
  ListChecks,
  LockKeyhole,
  MessageSquare,
  Plug,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Unplug,
  Webhook,
  X,
} from "lucide-react";
import { CONNECTION } from "@/lib/defaults";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusDot } from "@/components/ui/status-dot";
import { InstagramIcon } from "@/components/icons/instagram";

const ENV_SNIPPET = `# Server-side only — never expose these in the browser
IG_APP_ID=
IG_APP_SECRET=
IG_REDIRECT_URI=https://your-backend.example/oauth/callback
IG_WEBHOOK_VERIFY_TOKEN=
IG_ACCESS_TOKEN=
IG_ACCOUNT_ID=`;

const READINESS = [
  {
    label: "Frontend workspace",
    detail: "This UI — navigation, demo data and settings previews",
    done: true,
  },
  {
    label: "Authorized backend service",
    detail: "Receives webhooks, queues work and calls the messaging API",
    done: false,
  },
  {
    label: "Meta app credentials",
    detail: "App ID, secret and approved Instagram messaging permissions",
    done: false,
  },
  {
    label: "OAuth token storage",
    detail: "Encrypted server-side tokens with refresh handling",
    done: false,
  },
  {
    label: "Messaging webhook subscription",
    detail: "Verified endpoint subscribed to the account's message events",
    done: false,
  },
];

const STEPS = [
  {
    title: "Create a Meta app & connect an Instagram professional account",
    description:
      "A real deployment needs a Meta developer app with Instagram messaging permissions approved for the account you want to manage.",
    detail: "Account, app review",
  },
  {
    title: "Deploy an authorized backend",
    description:
      "OAuth, token storage, webhook verification and API calls must run server-side. This repository intentionally contains none of that.",
    detail: "Server, secrets",
  },
  {
    title: "Complete OAuth and store tokens securely",
    description:
      "The account owner authorizes the app. Access tokens are encrypted at rest and never sent to this browser bundle.",
    detail: "OAuth, encryption",
  },
  {
    title: "Subscribe to messaging webhooks",
    description:
      "The backend verifies Meta's webhook challenge, receives message and Reel events, and enforces idempotency and rate limits.",
    detail: "Webhooks, queues",
  },
  {
    title: "Connect this UI and enable the assistant",
    description:
      "A real status endpoint would replace the hard-coded 'not connected' state. Only then could replies be generated and delivered.",
    detail: "Status API, AI",
  },
];

const PERMISSIONS = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_insights",
  "pages_manage_metadata",
];

const COMPARISON = [
  {
    icon: MessageSquare,
    label: "Conversations",
    demo: "Seven fictional sample chats",
    real: "Live DMs from an authorized account",
  },
  {
    icon: Film,
    label: "Reels",
    demo: "Generated gradient thumbnails and pre-written summaries",
    real: "Accessible Reel metadata with model-generated analysis",
  },
  {
    icon: Send,
    label: "Replies",
    demo: "Drafts stored in the page only — sending disabled",
    real: "Delivered through the Instagram Messaging API",
  },
  {
    icon: Gauge,
    label: "Metrics",
    demo: "Static demo totals in src/data",
    real: "Computed from actual backend events",
  },
];

const SECTIONS = [
  { href: "#setup", label: "Setup guide" },
  { href: "#permissions", label: "Permissions" },
  { href: "#demo-vs-real", label: "Demo vs. real" },
];

export default function ConnectionPage() {
  const { notify, integration, mode, backendAvailable, oauthConfigured, status, connectInstagram, verifyIntegration, subscribeWebhooks, disconnectInstagram } = useApp();
  const [explainerOpen, setExplainerOpen] = useState(false);
  const live = mode === "live";
  const connected = integration?.demo === false && integration.status === "connected";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify({
        type: "success",
        title: `${label} copied`,
        message: "Reference configuration only — no credentials exist in this project.",
      });
    } catch {
      notify({
        type: "info",
        title: "Copy unavailable",
        message: "Your browser blocked clipboard access. Select the text manually.",
      });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="size-1.5 rounded-full bg-amber-400" />
            Connection
            <DemoBadge className="ml-1" />
          </>
        }
        title="Instagram connection"
        description={live
          ? `Connection to ${integration?.accountHandle ?? "the connected account"} is managed through Meta's official Instagram API.`
          : "This frontend connects to a ReelMate backend over OAuth. OAuth, token storage, webhook verification, and messaging calls run server-side — never in this browser bundle."}
        actions={
          <>
            <a href="#setup" className={buttonClasses("secondary", "md")}>
              <ListChecks className="size-4" />
              Setup guide
            </a>
            {!live && (
              <>
                {!oauthConfigured ? (
                  <Button
                    onClick={connectInstagram}
                    disabled
                    className="opacity-50 cursor-not-allowed"
                  >
                    <LockKeyhole className="size-4" />
                    OAuth not configured
                  </Button>
                ) : (
                  <Button
                    onClick={connectInstagram}
                    disabled={!backendAvailable}
                    className={!backendAvailable ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    {backendAvailable ? (
                      <>
                        <InstagramIcon className="size-4" />
                        Connect Instagram
                      </>
                    ) : (
                      <>
                        <InstagramIcon className="size-4" />
                        Backend unreachable
                      </>
                    )}
                  </Button>
                )}
                {!oauthConfigured && backendAvailable && (
                  <Button variant="secondary" size="sm" onClick={() => setExplainerOpen(true)}>
                    Set up OAuth
                  </Button>
                )}
              </>
            )}
            {live && (
              <Button onClick={disconnectInstagram} variant="secondary">
                <Unplug className="size-4" />
                Disconnect
              </Button>
            )}
            {live && (
              <Button onClick={disconnectInstagram} variant="secondary">
                <Unplug className="size-4" />
                Disconnect
              </Button>
            )}
          </>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-1.5 text-[10px]" aria-label="Connection page sections">
        {SECTIONS.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-white/40 transition hover:border-white/15 hover:text-white/75"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Panel className="relative overflow-hidden p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className={cn(
              "absolute -top-28 right-0 size-80 rounded-full blur-3xl",
              live ? "bg-emerald-500/[0.06]" : "bg-amber-500/[0.06]",
            )}
          />
          <div className="absolute -bottom-32 left-1/4 size-72 rounded-full bg-violet-600/[0.08] blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.035]">
              <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
              <InstagramIcon className="relative size-7 text-white/45" />
              <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border-2 border-ink-900 bg-ink-800">
                {connected ? (
                  <Check className="size-3 text-emerald-300/80" />
                ) : (
                  <Unplug className="size-3 text-amber-300/80" />
                )}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-semibold tracking-tight text-white">
                  {connected ? "Instagram account connected" : "No Instagram account connected"}
                </h2>
                <Badge variant={connected ? "emerald" : live ? "amber" : "amber"} dot>
                  {connected ? "Connected" : live ? "Live mode — account not linked" : "Not connected"}
                </Badge>
              </div>
              <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-white/45">
                {connected
                  ? `Replies are handled through the official Instagram Messaging API for ${integration?.accountHandle ?? "the connected account"}.`
                  : live
                    ? "This workspace runs in live mode but no eligible Instagram account is linked yet. Connect an account to enable receiving and delivery."
                    : backendAvailable
                      ? "OAuth, token storage, and messaging calls run server-side through the ReelMate backend."
                      : "The backend is unreachable. Start it to configure a real connection."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[9.5px]">
                <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]">
                  <LockKeyhole className="size-2.5" />
                  {connected ? "OAuth tokens stored server-side" : "No OAuth flow configured"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]">
                  <Webhook className="size-2.5" />
                  {connected ? integration?.webhooksSubscribed ? "Webhooks subscribed" : "Webhooks pending" : "No webhooks"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]">
                  <Server className="size-2.5" />
                  {backendAvailable ? "Backend reachable" : "Backend unreachable"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-2 rounded-xl border border-white/[0.07] bg-black/15 p-2 lg:min-w-[300px]">
            {[
              { label: "Account", value: connected ? integration?.accountHandle ?? "—" : "None" },
              {
                label: "Last check",
                value: integration?.lastCheckedLabel ?? "Never",
              },
              { label: "Mode", value: live ? "Live" : "Demo" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg px-2 py-2 text-center">
                <p className="text-[8.5px] tracking-wide text-white/25 uppercase">{item.label}</p>
                <p className="mt-1 text-[10.5px] font-medium text-white/60">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
          <span className="flex items-center gap-1.5 text-[10px] text-white/30">
            <StatusDot tone={connected ? "emerald" : "amber"} pulse={connected} />
            {connected ? "Connection active" : integration?.lastCheckedLabel ?? "Never — no eligible account connected"}
          </span>
          {integration?.unsupportedReason && (
            <span className="flex items-center gap-1.5 rounded-md border border-rose-400/15 bg-rose-500/[0.06] px-2 py-1 text-[10px] text-rose-200/80">
              <CircleX className="size-3" />
              {integration.unsupportedReason}
            </span>
          )}
          <span className="ml-auto text-[9.5px] text-white/25">
            {backendAvailable
              ? live
                ? "Status checked through Meta's official Instagram API"
                : "Status served by the ReelMate backend"
              : "Status is local-only — backend unreachable"}
          </span>
        </div>
      </Panel>

      {backendAvailable && !live && !oauthConfigured && (
        <Panel className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">Instagram OAuth is not configured</h3>
              <p className="mt-1 text-[11px] text-white/60 leading-relaxed">
                The "Connect Instagram" button is disabled because the backend has no
                <code className="text-white/80">IG_APP_ID</code> and
                <code className="text-white/80">IG_APP_SECRET</code>. Without them the app
                cannot build Meta's official Instagram OAuth URL.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
            <h4 className="text-[10px] font-semibold tracking-wider text-white/40 uppercase mb-2">
              What to do
            </h4>
            <ol className="space-y-2 text-[10.5px] text-white/55 list-decimal list-inside">
              <li>
                Create a Meta app at{" "}
                <a
                  href="https://developers.facebook.com/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-violet-400 underline"
                >
                  developers.facebook.com
                </a>
                .
              </li>
              <li>
                Add an Instagram product (Basic Display or Messaging) and copy your App ID and
                App Secret.
              </li>
              <li>
                Set the OAuth redirect URI to{" "}
                <code className="text-white/80">
                  http://localhost:8000/api/v1/integration/oauth/callback
                </code>
              </li>
              <li>
                Add <code className="text-white/80">IG_APP_ID</code> and
                <code className="text-white/80">IG_APP_SECRET</code> to
                <code className="text-white/80">backend/.env</code>, then restart the backend.
              </li>
            </ol>
          </div>
          <p className="mt-3 text-[10px] text-white/45">
            Only a Meta-verified Instagram Business or Creator account can be connected through
            the official messaging API — personal accounts are not supported.
          </p>
        </Panel>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel id="setup" className="scroll-mt-24 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-white">Setup guide</h2>
              <p className="mt-1 text-[11px] text-white/40">
                What a real, authorized integration would require — outside this frontend.
              </p>
            </div>
            <Badge variant="amber">Not configured</Badge>
          </div>

          <ol className="mt-5 space-y-0">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative flex gap-3.5 pb-5 last:pb-0">
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-9 left-[15px] h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-violet-400/25 to-white/[0.04]"
                  />
                )}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/[0.09] bg-white/[0.03] text-[10px] font-semibold text-white/45">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[11.5px] leading-snug font-medium text-white/85">
                      {step.title}
                    </p>
                    <Badge variant="neutral" className="shrink-0 text-[8.5px]">
                      {step.detail}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-white/35">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold text-white/80">Integration readiness</h3>
              <span className="text-[9.5px] text-white/30">
                {connected
                  ? `4 / ${READINESS.length}`
                  : backendAvailable
                    ? `2 / ${READINESS.length}`
                    : `1 / ${READINESS.length}`}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-400"
                style={{ width: connected ? "100%" : backendAvailable ? "40%" : "20%" }}
              />
            </div>
            <ul className="mt-3 space-y-2.5">
              {[
                { label: "Frontend workspace", detail: "This UI — navigation, demo data and settings previews", done: true },
                {
                  label: "Authorized backend service",
                  detail: "Receives webhooks, queues work and calls the messaging API",
                  done: backendAvailable,
                },
                {
                  label: "Meta app credentials",
                  detail: "App ID, secret and approved Instagram messaging permissions",
                  done: backendAvailable,
                },
                {
                  label: "OAuth token storage",
                  detail: "Encrypted server-side tokens with refresh handling",
                  done: connected,
                },
                {
                  label: "Messaging webhook subscription",
                  detail: "Verified endpoint subscribed to the account's message events",
                  done: connected && Boolean(integration?.webhooksSubscribed),
                },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                      item.done ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/10 text-rose-300/70",
                    )}
                  >
                    {item.done ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("text-[10px] font-medium", item.done ? "text-white/70" : "text-white/45")}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[9px] leading-relaxed text-white/25">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <KeyRound className="size-3.5 text-violet-300/70" />
                <h3 className="text-[11px] font-semibold text-white/80">Backend environment</h3>
              </div>
              <button
                type="button"
                onClick={() => copy(ENV_SNIPPET, "Reference config")}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] text-violet-300/70 transition hover:bg-violet-500/10 hover:text-violet-200"
              >
                <Copy className="size-2.5" />
                Copy
              </button>
            </div>
            <pre className="overflow-x-auto bg-black/25 px-4 py-3 text-[9.5px] leading-relaxed text-white/40">
              <code>{ENV_SNIPPET}</code>
            </pre>
            <p className="border-t border-white/[0.05] px-4 py-2.5 text-[8.5px] leading-relaxed text-white/25">
              Reference variable names only. No credentials or token values exist in this
              repository.
            </p>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel id="permissions" className="scroll-mt-24 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-violet-300/80" />
            <h2 className="font-display text-sm font-semibold text-white">
              Permissions a real app would request
            </h2>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-white/35">
            Exact scopes depend on Meta&apos;s current review process and what the account owner
            approves.
          </p>
          <ul className="mt-3 space-y-1.5">
            {PERMISSIONS.map((permission) => {
              const granted = connected && Boolean(integration?.scopes?.includes(permission));
              return (
                <li
                  key={permission}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                >
                  <code className="flex-1 truncate text-[9.5px] text-white/45">{permission}</code>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 text-[8.5px]",
                      granted ? "text-emerald-300/60" : "text-rose-300/60",
                    )}
                  >
                    {granted ? <Check className="size-2.5" /> : <CircleX className="size-2.5" />}
                    {granted ? "Granted" : "Not granted"}
                  </span>
                </li>
              )}
            )}
          </ul>
          <a
            href="https://developers.facebook.com/docs/instagram-platform"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-1 text-[10px] text-violet-300/70 transition hover:text-violet-200"
          >
            Instagram Platform documentation
            <ExternalLink className="size-3" />
          </a>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-amber-300/70" />
            <h2 className="font-display text-sm font-semibold text-white">Data handling principles</h2>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-white/35">
            Guidelines a production backend should follow — included here so the demo does not
            imply otherwise.
          </p>
          <ul className="mt-3 space-y-2.5">
            {[
              "Access tokens stay server-side, encrypted at rest, never in browser storage.",
              "Only Reels the connected account can access are analyzed — no scraping.",
              "Reply sending respects rate limits, user consent and quiet hours.",
              "Message content and logs have a clear retention policy and deletion path.",
              "AI drafts are disclosed and review mode is available by default for sensitive chats.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-[10px] leading-relaxed text-white/40">
                <Check className="mt-0.5 size-3 shrink-0 text-emerald-300/60" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel id="demo-vs-real" className="mt-4 scroll-mt-24 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Plug className="size-4 text-violet-300/70" />
            <h2 className="font-display text-sm font-semibold text-white">Demo vs. real integration</h2>
          </div>
          <DemoBadge label="This build = demo" />
        </div>

        <div className="grid grid-cols-[1fr] divide-y divide-white/[0.05] text-[10.5px] sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] sm:divide-y-0">
          <div className="hidden bg-white/[0.02] px-4 py-2.5 text-[9px] font-semibold tracking-wider text-white/30 uppercase sm:block">
            Area
          </div>
          <div className="hidden border-l border-white/[0.05] bg-amber-400/[0.03] px-4 py-2.5 text-[9px] font-semibold tracking-wider text-amber-200/60 uppercase sm:block">
            This demo
          </div>
          <div className="hidden border-l border-white/[0.05] px-4 py-2.5 text-[9px] font-semibold tracking-wider text-white/30 uppercase sm:block">
            Real integration
          </div>

          {COMPARISON.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="contents">
                <div className="flex items-center gap-2 px-4 py-3 sm:py-3.5">
                  <Icon className="size-3.5 text-white/30" />
                  <span className="text-[10.5px] font-medium text-white/70">{row.label}</span>
                </div>
                <div className="border-t border-white/[0.04] bg-amber-400/[0.03] px-4 py-3 sm:border-t-0 sm:border-l sm:py-3.5">
                  <span className="mb-1 block text-[8.5px] font-semibold tracking-wider text-amber-200/50 uppercase sm:hidden">
                    This demo
                  </span>
                  <span className="leading-relaxed text-white/45">{row.demo}</span>
                </div>
                <div className="border-t border-white/[0.04] px-4 py-3 sm:border-t-0 sm:border-l sm:py-3.5">
                  <span className="mb-1 block text-[8.5px] font-semibold tracking-wider text-white/25 uppercase sm:hidden">
                    Real integration
                  </span>
                  <span className="leading-relaxed text-white/35">{row.real}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/[0.06] bg-white/[0.012] px-5 py-3">
          <p className="text-[9px] leading-relaxed text-white/25">
            This page is documentation for the preview, not a connection wizard. No action here
            connects an account or transmits data.
          </p>
        </div>
      </Panel>

      <div className="mt-4 panel relative overflow-hidden p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -top-20 right-0 size-64 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-[10px] font-medium tracking-wide text-violet-300/80 uppercase">
              <Sparkles className="size-3" />
              Ready to explore?
            </p>
            <h2 className="mt-1 font-display text-base font-semibold text-white">
              The workflow is fully previewable with sample data
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              Toggle the assistant on, open a conversation, inspect a Reel analysis and generate a
              demo draft. Delivery stays disabled throughout.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/assistant" className={buttonClasses("secondary", "md")}>
              Configure assistant
            </Link>
            <Link href="/" className={buttonClasses("primary", "md")}>
              Open dashboard
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <Modal
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        title="Instagram connection is not available"
        description="This is intentional for a frontend-only preview."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setExplainerOpen(false)}
              className={buttonClasses("ghost", "md")}
            >
              Close
            </button>
            <div className="flex gap-2">
              <a href="#setup" onClick={() => setExplainerOpen(false)} className={buttonClasses("secondary", "md")}>
                <ListChecks className="size-4" />
                Read setup guide
              </a>
              <a
                href="https://developers.facebook.com/docs/instagram-platform"
                target="_blank"
                rel="noreferrer noopener"
                className={buttonClasses("primary", "md")}
              >
                Meta documentation
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-400/[0.05] p-3.5">
            <Unplug className="mt-0.5 size-4 shrink-0 text-amber-300/80" />
            <p className="text-[11px] leading-relaxed text-amber-100/65">
              A connect button here would be fake. Real connectivity requires OAuth with Meta, a
              server-side token exchange, webhook verification and an approved messaging
              integration — none of which exist in this repository.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: Server, label: "Authorized backend", value: "Missing" },
              { icon: KeyRound, label: "OAuth credentials", value: "Missing" },
              { icon: Webhook, label: "Webhook endpoint", value: "Missing" },
              { icon: InstagramIcon, label: "Instagram account", value: "Not linked" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5"
                >
                  <Icon className="size-4 text-white/30" />
                  <span className="flex-1 text-[10px] text-white/50">{item.label}</span>
                  <Badge variant="rose">{item.value}</Badge>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] leading-relaxed text-white/35">
            Use the demo workspace to explore the intended workflow with clearly labelled sample
            data. No message is ever received from or sent to Instagram.
          </p>
        </div>
      </Modal>
    </div>
  );
}
