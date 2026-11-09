import type {
  ActivityItem,
  AnalyzeResult,
  AssistantSettings,
  AssistantStatus,
  BackendJob,
  ConnectionState,
  Conversation,
  DashboardStats,
  DraftResult,
  IntegrationResponse,
  Reel,
  SendMessageResult,
} from "@/types";

/**
 * Browser-side client for the server-side Next.js proxy.
 *
 * The proxy holds BACKEND_URL / BACKEND_API_TOKEN. No token or backend URL is
 * ever exposed with NEXT_PUBLIC_*, so the browser only calls same-origin paths.
 */
export class BackendError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function backendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  headers.set("accept", "application/json");

  const response = await fetch(`/api/backend/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  const body: unknown = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const envelope = body as
      | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
      | null;
    throw new BackendError(
      response.status,
      envelope?.error?.code || "backend_error",
      envelope?.error?.message || `The backend returned HTTP ${response.status}.`,
      envelope?.error?.details || {},
    );
  }
  return body as T;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  unreadTotal: number;
}

export interface ReelListResponse {
  reels: Reel[];
  total: number;
}

export interface ActivityListResponse {
  activity: ActivityItem[];
  total: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recentActivity: ActivityItem[];
  attention: Conversation[];
  connection: ConnectionState;
  status: AssistantStatus;
  generatedAt: string;
}

export interface JobListResponse {
  jobs: BackendJob[];
  total: number;
}

export const api = {
  status: () => backendFetch<AssistantStatus>("status"),
  dashboard: () => backendFetch<DashboardResponse>("dashboard"),
  settings: () => backendFetch<AssistantSettings>("settings"),
  updateSettings: (settings: AssistantSettings) =>
    backendFetch<AssistantSettings>("settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  resetSettings: () => backendFetch<AssistantSettings>("settings/reset", { method: "POST" }),
  activation: (enabled: boolean) =>
    backendFetch<{ enabled: boolean; mode: "demo" | "live"; deliveryEnabled: boolean }>(
      "assistant/activation",
      { method: "POST", body: JSON.stringify({ enabled }) },
    ),
  inbox: (query = "", filter = "all") => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (filter !== "all") params.set("filter", filter);
    return backendFetch<ConversationListResponse>(`inbox?${params.toString()}`);
  },
  conversation: (id: string) =>
    backendFetch<Conversation>(`conversations/${encodeURIComponent(id)}`),
  markRead: (id: string) =>
    backendFetch<{ ok: boolean; unread: number }>(
      `conversations/${encodeURIComponent(id)}/read`,
      { method: "POST" },
    ),
  draft: (conversationId: string, instruction?: string) =>
    backendFetch<DraftResult>(`conversations/${encodeURIComponent(conversationId)}/draft`, {
      method: "POST",
      body: JSON.stringify({ instruction: instruction || null }),
    }),
  send: (conversationId: string, text: string) =>
    backendFetch<SendMessageResult>(`conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  reels: () => backendFetch<ReelListResponse>("reels"),
  analyzeReel: (id: string, force = false) =>
    backendFetch<AnalyzeResult>(`reels/${encodeURIComponent(id)}/analyze`, {
      method: "POST",
      body: JSON.stringify({ force }),
    }),
  uploadReel: (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return backendFetch<Reel>(`reels/${encodeURIComponent(id)}/upload`, {
      method: "POST",
      body,
    });
  },
  activity: (kind?: string, status?: string) => {
    const params = new URLSearchParams();
    if (kind && kind !== "all") params.set("kind", kind);
    if (status && status !== "all") params.set("status", status);
    return backendFetch<ActivityListResponse>(`activity?${params.toString()}`);
  },
  integration: () => backendFetch<IntegrationResponse>("integration"),
  connectUrl: () =>
    backendFetch<{ configured: boolean; url: string | null; message: string; missing: string[] }>(
      "integration/connect-url",
    ),
  verifyIntegration: () =>
    backendFetch<{ status: ConnectionState; message: string; demo: boolean }>(
      "integration/verify",
      { method: "POST" },
    ),
  subscribeWebhooks: () =>
    backendFetch<{ status: ConnectionState; message: string; demo: boolean }>(
      "integration/subscribe-webhooks",
      { method: "POST" },
    ),
  disconnect: () =>
    backendFetch<{ status: ConnectionState; message: string; demo: boolean }>(
      "integration/disconnect",
      { method: "POST" },
    ),
  jobs: () => backendFetch<JobListResponse>("jobs"),
  job: (id: string) => backendFetch<BackendJob>(`jobs/${encodeURIComponent(id)}`),
  resetDemo: () => backendFetch<{ ok: boolean; message: string }>("demo/reset", { method: "POST" }),
};

export function errorMessage(error: unknown): string {
  if (error instanceof BackendError) return error.message;
  if (error instanceof Error) return error.message;
  return "The backend request failed.";
}
