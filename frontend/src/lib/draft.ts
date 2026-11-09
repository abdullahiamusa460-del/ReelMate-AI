import type { AssistantSettings } from "@/types";

/**
 * Produces a deterministic, clearly-labelled demo reply from settings.
 * No AI model is called. Used only to preview the assistant's configuration.
 */
export function buildDemoReply(
  settings: AssistantSettings,
  context?: { topic?: string; hasReel?: boolean },
): string {
  const topic = context?.topic?.toLowerCase();
  const emoji = settings.includeEmoji ? " ✨" : "";

  const opener: Record<AssistantSettings["personality"], string> = {
    friendly: "Love this",
    professional: "Thanks for sharing this",
    witty: "Okay, this is genuinely good",
    supportive: "This is such a great find",
    curious: "This is really interesting",
  };

  const subject = topic
    ? ` — the ${topic} angle is great`
    : context?.hasReel
      ? " — thanks for sending it over"
      : "";

  if (settings.length === "short") {
    return `${opener[settings.personality]}${subject}. Count me in${emoji}`;
  }

  if (settings.length === "detailed") {
    return `${opener[settings.personality]}${subject}. I had a look and it seems genuinely useful, especially the practical parts. I'd be up for trying it — want to pick a time and go from there?${emoji}`;
  }

  return `${opener[settings.personality]}${subject}. This looks genuinely useful — I'd be up for trying it. Want to sort out the details?${emoji}`;
}
