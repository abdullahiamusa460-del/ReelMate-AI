import type { AssistantSettings, ConnectionState } from "@/types";

export const DEFAULT_SETTINGS: AssistantSettings = {
  personality: "friendly",
  tone: "casual",
  language: "Match sender's language",
  length: "short",
  includeEmoji: true,
  customInstructions: "",
  autoReply: {
    sendMode: "automatic",
    onlyWithReels: false,
    skipMessageRequests: true,
    skipGroupChats: true,
    pauseForSensitiveTopics: true,
    replyDelaySec: 20,
    maxPerHour: 30,
    quietHours: { enabled: false, start: "23:00", end: "07:00" },
    excludeKeywords: "",
  },
};

/**
 * Connection state is intentionally fixed to "not connected".
 * This frontend contains no Instagram integration. A backend that owns the
 * OAuth flow and tokens would be responsible for reporting a real status.
 */
export const CONNECTION: ConnectionState = {
  status: "not_connected",
  accountHandle: null,
  lastCheckedLabel: "Never — no backend configured",
};

export const LANGUAGES = [
  "Match sender's language",
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Hindi",
  "Japanese",
  "Arabic",
];

export const STORAGE_KEY = "reelmate-ai:v1";
