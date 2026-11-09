/**
 * SIMULATED DEMO DATA — NOT REAL INSTAGRAM DATA.
 *
 * Pre-written "analysis results" used when a visitor clicks the demo analyze
 * action for a Reel that has not been analyzed yet. No AI model is called; the
 * text below is hard-coded sample content.
 */
import type { ReelInsight } from "@/types";

export const DEMO_INSIGHTS: Record<string, ReelInsight> = {
  r4: {
    summary:
      "A short build-in-public update at week 12: the creator shows a landing page redesign, shares signup numbers, and explains one pricing experiment that did not work. The tone is candid and lesson-focused.",
    topics: ["Building in public", "Indie hacking", "SaaS", "Pricing"],
    sentiment: "Reflective",
    suggestedReplies: [
      {
        tone: "Casual",
        text: "The failed pricing test is the most useful part honestly. Thanks for sharing the numbers!",
      },
      {
        tone: "Curious",
        text: "Interesting update — what made you change the pricing back?",
      },
    ],
  },
  r5: {
    summary:
      "A ten-minute, no-equipment full-body circuit. Three rounds of squats, push-ups, reverse lunges and a plank hold, with 20 seconds rest between exercises. The creator suggests doing it before breakfast.",
    topics: ["Fitness", "Home workouts", "Morning routine", "No equipment"],
    sentiment: "Energetic",
    suggestedReplies: [
      {
        tone: "Enthusiastic",
        text: "I'm in! Ten minutes before breakfast is actually doable 💪",
      },
      {
        tone: "Casual",
        text: "Tomorrow morning works. If I'm late, start without me 😅",
      },
      {
        tone: "Balanced",
        text: "That circuit looks doable. Let's try it tomorrow morning and see how it feels.",
      },
    ],
  },
};
