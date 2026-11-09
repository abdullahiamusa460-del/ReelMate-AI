"use client";

import Link from "next/link";
import { ArrowRight, Film, Inbox, MessageSquare, Send, Timer } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useSimulatedLoading } from "@/lib/useSimulatedLoading";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, StatSkeleton } from "@/components/ui/skeleton";
import { AiControlCard } from "@/components/dashboard/ai-control-card";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { WorkflowCard } from "@/components/dashboard/workflow-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { AttentionQueue } from "@/components/dashboard/attention-queue";
import { StatCard } from "@/components/dashboard/stat-card";

function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="panel p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-72 max-w-full" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
          <Skeleton className="hidden h-9 w-16 rounded-full sm:block" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="panel h-[360px] p-6 xl:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-52" />
          <Skeleton className="mt-8 h-52 w-full" />
        </div>
        <div className="panel h-[360px] p-6">
          <Skeleton className="h-4 w-32" />
          <div className="mt-6 space-y-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40 max-w-full" />
                  <Skeleton className="h-2.5 w-52 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const simulated = useSimulatedLoading(700);
  const { stats, ready, backendAvailable, mode, connection } = useApp();
  const loading = simulated || !ready;

  const live = mode === "live";
  const account = connection.accountHandle
    ? `@${connection.accountHandle.replace(/^@/, "")}`
    : null;

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="size-1.5 rounded-full bg-violet-400" />
            Workspace overview
            {live ? (
              <Badge variant="emerald" dot className="ml-1">
                Live workspace
              </Badge>
            ) : (
              <DemoBadge className="ml-1" />
            )}
          </>
        }
        title="Welcome back, Alex"
        description={
          live
            ? `Connected to ${account ?? "an Instagram professional account"}. Review incoming DMs, shared Reels and the replies the assistant prepared or delivered.`
            : backendAvailable
              ? "This demo workspace is served by the ReelMate backend with clearly labelled sample data. No Instagram message is received or sent until an eligible account is connected."
              : "The backend is unreachable, so this page is showing a local preview. Start the backend to load the persisted workspace."
        }
        actions={
          <>
            <Link href="/activity" className={buttonClasses("secondary", "md")}>
              View history
            </Link>
            <Link href="/inbox" className={buttonClasses("primary", "md")}>
              <Inbox className="size-4" />
              Open inbox
              <ArrowRight className="size-3.5" />
            </Link>
          </>
        }
      />

      {loading ? (
        <DashboardLoading />
      ) : (
        <div className="space-y-4">
          <div className="animate-fade-up">
            <AiControlCard />
          </div>

          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            style={{ animationDelay: "60ms" }}
          >
            <StatCard
              label="Messages received"
              value={formatNumber(stats.totalMessages)}
              delta={stats.deltas.messages}
              icon={MessageSquare}
              series={stats.weekly}
              hint={
                live
                  ? "Messages received through the official Instagram webhook"
                  : "Stored demo messages — no Instagram message was received"
              }
              accent="violet"
            />
            <StatCard
              label="Reels processed"
              value={formatNumber(stats.reelsProcessed)}
              delta={stats.deltas.reels}
              icon={Film}
              hint={
                live
                  ? "Reels with an analysis produced from actual media"
                  : "Analysed sample Reels, including pre-written demo analysis"
              }
              accent="indigo"
            />
            <StatCard
              label="Automatic replies"
              value={formatNumber(stats.autoReplies)}
              delta={stats.deltas.replies}
              icon={Send}
              hint={
                live
                  ? "Replies Instagram accepted for delivery"
                  : "Demo replies stored — none were delivered to Instagram"
              }
              accent="emerald"
            />
            <StatCard
              label="Avg. response time"
              value={`${stats.avgResponseSec}s`}
              icon={Timer}
              hint={
                live
                  ? "Median time between an incoming message and a delivered reply"
                  : "Computed from demo timestamps, not real message latency"
              }
              accent="sky"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ActivityChart />
            </div>
            <WorkflowCard />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RecentActivity />
            </div>
            <AttentionQueue />
          </div>
        </div>
      )}
    </div>
  );
}
