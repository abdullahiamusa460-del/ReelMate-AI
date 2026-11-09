/**
 * Shared domain types for the ReelMate AI frontend.
 *
 * These describe the shape of data the UI expects. In this repository the data
 * only ever comes from `src/data/demo.ts` (clearly labelled sample data). A real
 * deployment would populate the same shapes from an authorized backend.
 */

export type ReplyStatus = "auto_replied" | "needs_review" | "pending" | "skipped";

export interface ChatMessage {
  id: string;
  from: "them" | "ai";
  text: string;
  /** Minutes before "now". Kept relative so rendering is deterministic (no SSR/CSR mismatch). */
  minutesAgo: number;
  /** If the message carries a shared Reel, its id. */
  reelId?: string;
}

export interface Conversation {
  id: string;
  username: string;
  displayName: string;
  /** Hue (0-360) used to generate a placeholder avatar gradient. */
  hue: number;
  unread: number;
  messages: ChatMessage[];
  replyStatus: ReplyStatus;
  isMessageRequest: boolean;
  /** Whether the AI workflow would consider this conversation eligible. */
  eligible: boolean;
  eligibilityNote: string;
  /** True when the conversation is sample data, false when it came from Instagram. */
  isDemo?: boolean;
  lastMessageAt?: string | null;
}

export interface SuggestedReply {
  tone: string;
  text: string;
}

/** The subset of Reel data produced by the (simulated) analysis step. */
export interface ReelInsight {
  summary: string;
  topics: string[];
  sentiment: string;
  suggestedReplies: SuggestedReply[];
}

export interface Reel {
  id: string;
  conversationId: string;
  sharedBy: string;
  creator: string;
  caption: string;
  durationSec: number;
  views: number | null;
  likes: number | null;
  audio: string | null;
  receivedMinutesAgo: number;
  /** Whether the Reel's media would be accessible to the backend. */
  accessible: boolean;
  inaccessibleReason?: string;
  summary: string | null;
  topics: string[];
  sentiment: string | null;
  suggestedReplies: SuggestedReply[];
  /** Two hues for the generated thumbnail gradient. */
  hues: [number, number];
  isDemo?: boolean;
  analysisStatus?: "pending" | "queued" | "analyzing" | "analyzed" | "failed" | "unavailable";
  analysisSource?: string | null;
  analysisModel?: string | null;
  mediaAccessed?: boolean;
  limitations?: string[];
  uploadAvailable?: boolean;
  uploadRequired?: boolean;
}

export type ActivityKind = "message" | "reel" | "reply" | "integration" | "system";
export type ActivityStatus = "completed" | "skipped" | "failed";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  status: ActivityStatus;
  title: string;
  detail: string;
  username: string;
  minutesAgo: number;
  conversationId?: string;
  isDemo?: boolean;
  createdAt?: string | null;
}

export interface DashboardStats {
  totalMessages: number;
  reelsProcessed: number;
  autoReplies: number;
  avgResponseSec: number;
  /** Messages per day for the last 7 days (oldest first). */
  weekly: number[];
  deltas: { messages: number; reels: number; replies: number };
}

export type Personality = "friendly" | "professional" | "witty" | "supportive" | "curious";
export type Tone = "casual" | "balanced" | "formal" | "enthusiastic";
export type ResponseLength = "short" | "medium" | "detailed";
export type SendMode = "automatic" | "review";

export interface AssistantSettings {
  personality: Personality;
  tone: Tone;
  language: string;
  length: ResponseLength;
  includeEmoji: boolean;
  customInstructions: string;
  autoReply: {
    sendMode: SendMode;
    onlyWithReels: boolean;
    skipMessageRequests: boolean;
    skipGroupChats: boolean;
    pauseForSensitiveTopics: boolean;
    replyDelaySec: number;
    maxPerHour: number;
    quietHours: { enabled: boolean; start: string; end: string };
    excludeKeywords: string;
  };
}

export type ConnectionStatus =
  | "not_connected"
  | "connected"
  | "error"
  | "unsupported_personal_account"
  | "pending";

export interface ConnectionState {
  status: ConnectionStatus;
  accountHandle: string | null;
  accountType?: string | null;
  lastCheckedLabel: string;
  lastCheckedAt?: string | null;
  messagingPermitted?: boolean;
  webhooksSubscribed?: boolean;
  unsupportedReason?: string | null;
  error?: string | null;
}

export interface AIStatus {
  enabled: boolean;
  provider: string;
  model: string | null;
  configured: boolean;
  multimodal: boolean;
  videoCapable: boolean;
  templateFallback: boolean;
}

export interface AssistantStatus {
  mode: "demo" | "live";
  demo: boolean;
  aiEnabled: boolean;
  deliveryEnabled: boolean;
  receiveEnabled: boolean;
  reelAnalysisAvailable: boolean;
  uploadAnalysisAvailable: boolean;
  personalAccountSupported: boolean;
  connection: ConnectionState;
  ai: AIStatus;
  capabilities: Record<string, boolean>;
  limitations: string[];
}

export interface IntegrationDetail extends ConnectionState {
  provider: string;
  scopes: string[];
  tokenExpiresAt?: string | null;
  connectedAt?: string | null;
  demo: boolean;
  configured: boolean;
}

export interface IntegrationResponse {
  connection: ConnectionState;
  detail: IntegrationDetail;
  status: AssistantStatus;
}

export interface DraftResult {
  text: string;
  source: "model" | "template" | "cached";
  model: string | null;
  delivered: boolean;
  warning: string | null;
}

export interface SendMessageResult {
  message: ChatMessage;
  delivered: boolean;
  mode: "demo" | "live";
  externalId: string | null;
  warning: string | null;
}

export interface AnalyzeResult {
  status: "queued" | "analyzed" | "unavailable" | "failed";
  jobId: string | null;
  analysis: (ReelInsight & {
    source: string;
    model: string | null;
    mediaAccessed: boolean;
    framesAnalyzed: number;
    limitations: string[];
  }) | null;
  message: string;
  uploadRequired: boolean;
}

export interface BackendJob {
  id: string;
  kind: string;
  status: "queued" | "running" | "succeeded" | "failed" | "dead";
  attempts: number;
  lastError: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = "success" | "info" | "warning" | "error";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  read: boolean;
  createdAt: number;
}
