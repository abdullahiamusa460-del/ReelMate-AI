import Link from "next/link";
import { ArrowRight, Home, Sparkles } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <DemoBadge label="Frontend demo" />
      <p className="mt-6 font-display text-[72px] leading-none font-semibold tracking-tighter text-gradient sm:text-[96px]">
        404
      </p>
      <h1 className="mt-2 font-display text-xl font-semibold text-white sm:text-2xl">
        This page isn&apos;t in the demo
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/45">
        The page you&apos;re looking for doesn&apos;t exist. Head back to the dashboard to explore
        the simulated ReelMate AI workflow.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className={buttonClasses("primary", "md")}>
          <Home className="size-4" />
          Back to dashboard
        </Link>
        <Link href="/inbox" className={buttonClasses("secondary", "md")}>
          <Sparkles className="size-4" />
          Explore demo inbox
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
