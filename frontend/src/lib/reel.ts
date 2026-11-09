import type { Reel, ReelInsight } from "@/types";

export type ReelState = "analyzed" | "analyzing" | "awaiting" | "unavailable";

export function getReelInsight(
  reel: Reel,
  analyses: Record<string, ReelInsight>,
): ReelInsight | null {
  if (analyses[reel.id]) return analyses[reel.id];
  if (!reel.summary) return null;
  return {
    summary: reel.summary,
    topics: reel.topics,
    sentiment: reel.sentiment ?? "Neutral",
    suggestedReplies: reel.suggestedReplies,
  };
}

export function getReelState(
  reel: Reel,
  analyses: Record<string, ReelInsight>,
  analyzing: string[],
): ReelState {
  if (!reel.accessible) return "unavailable";
  if (analyses[reel.id] || reel.summary) return "analyzed";
  if (analyzing.includes(reel.id)) return "analyzing";
  return "awaiting";
}
