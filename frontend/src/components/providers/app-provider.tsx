"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ActivityItem,
  AppNotification,
  AssistantSettings,
  AssistantStatus,
  ConnectionState,
  Conversation,
  DashboardStats,
  DraftResult,
  IntegrationDetail,
  NotificationType,
  Reel,
  ReelInsight,
  SendMessageResult,
} from "@/types";
import { DEMO_ACTIVITY, DEMO_CONVERSATIONS, DEMO_REELS, DEMO_STATS } from "@/data";
import { CONNECTION, DEFAULT_SETTINGS, STORAGE_KEY } from "@/lib/defaults";
import { api, errorMessage } from "@/lib/api";
import { buildDemoReply } from "@/lib/draft";

interface NotifyInput {
  type: NotificationType;
  title: string;
  message?: string;
}

interface AppContextValue {
  /** False until local preferences and the first backend fetch have completed. */
  ready: boolean;
  /** True when the FastAPI backend answered through the Next.js proxy. */
  backendAvailable: boolean;
  backendError: string | null;
  mode: "demo" | "live";
  status: AssistantStatus | null;
  connection: ConnectionState;
  integration: IntegrationDetail | null;
  oauthConfigured: boolean | null;
  connectInstagram: () => Promise<void>;
  verifyIntegration: () => Promise<void>;
  subscribeWebhooks: () => Promise<void>;
  disconnectInstagram: () => Promise<void>;
  conversations: Conversation[];
  reels: Reel[];
  activity: ActivityItem[];
  stats: DashboardStats;
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;
  settings: AssistantSettings;
  saveSettings: (next: AssistantSettings) => void;
  resetSettings: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  notify: (input: NotifyInput) => void;
  dismissNotification: (id: string) => void;
  markAllRead: () => void;
  analyses: Record<string, ReelInsight>;
  analyzing: string[];
  uploading: string[];
  analyzeReel: (reelId: string) => void;
  uploadReel: (reelId: string, file: File) => Promise<void>;
  draftReply: (conversationId: string, instruction?: string) => Promise<DraftResult | null>;
  sendReply: (conversationId: string, text: string) => Promise<SendMessageResult | null>;
  markRead: (conversationId: string) => void;
  refresh: () => Promise<void>;
  resetDemo: () => void;
}

interface PersistedState {
  aiEnabled: boolean;
  settings: AssistantSettings;
  analyses: Record<string, ReelInsight>;
}

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: "seed-1",
    type: "info",
    title: "Workspace status loaded from the backend",
    message:
      "Demo mode and live mode are separate. Open Connection to see whether an eligible Instagram account is actually linked.",
    read: false,
    createdAt: 0,
  },
  {
    id: "seed-2",
    type: "warning",
    title: "No reply is ever claimed without delivery",
    message:
      "In demo mode replies are stored locally and clearly labelled. Live delivery requires Meta's official Instagram API.",
    read: false,
    createdAt: 0,
  },
];

const AppContext = createContext<AppContextValue | null>(null);

function normalizeSettings(input: unknown): AssistantSettings {
  const candidate = (input ?? {}) as Partial<AssistantSettings>;
  const autoReply = (candidate.autoReply ?? {}) as Partial<AssistantSettings["autoReply"]>;
  return {
    ...DEFAULT_SETTINGS,
    ...candidate,
    autoReply: {
      ...DEFAULT_SETTINGS.autoReply,
      ...autoReply,
      quietHours: {
        ...DEFAULT_SETTINGS.autoReply.quietHours,
        ...(autoReply.quietHours ?? {}),
      },
    },
  };
}

function readPersisted(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      aiEnabled: typeof parsed.aiEnabled === "boolean" ? parsed.aiEnabled : undefined,
      settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : undefined,
      analyses:
        parsed.analyses && typeof parsed.analyses === "object" ? parsed.analyses : undefined,
    };
  } catch {
    return {};
  }
}

function insightsFromReels(reels: Reel[]): Record<string, ReelInsight> {
  const result: Record<string, ReelInsight> = {};
  for (const reel of reels) {
    if (!reel.summary) continue;
    result[reel.id] = {
      summary: reel.summary,
      topics: reel.topics,
      sentiment: reel.sentiment ?? "Neutral",
      suggestedReplies: reel.suggestedReplies,
    };
  }
  return result;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [integration, setIntegration] = useState<IntegrationDetail | null>(null);
  const [oauthConfigured, setOAuthConfigured] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(DEMO_CONVERSATIONS);
  const [reels, setReels] = useState<Reel[]>(DEMO_REELS);
  const [activity, setActivity] = useState<ActivityItem[]>(DEMO_ACTIVITY);
  const [stats, setStats] = useState<DashboardStats>(DEMO_STATS);
  const [aiEnabled, setAiEnabledState] = useState(false);
  const [settings, setSettings] = useState<AssistantSettings>(DEFAULT_SETTINGS);
  const [analyses, setAnalyses] = useState<Record<string, ReelInsight>>({});
  const [analyzing, setAnalyzing] = useState<string[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const idRef = useRef(0);

  const notify = useCallback((input: NotifyInput) => {
    idRef.current += 1;
    const id = `n-${Date.now()}-${idRef.current}`;
    setNotifications((prev) => [
      { ...input, id, read: false, createdAt: Date.now() },
      ...prev,
    ]);
  }, []);

  const applyReels = useCallback((next: Reel[]) => {
    setReels(next);
    setAnalyses(insightsFromReels(next));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextStatus, dashboard, inbox, reelList, activityList, nextSettings, nextIntegration] =
        await Promise.all([
          api.status(),
          api.dashboard(),
          api.inbox(),
          api.reels(),
          api.activity(),
          api.settings(),
          api.integration(),
        ]);
      setStatus(nextStatus);
      setIntegration(nextIntegration.detail);
      setOAuthConfigured(nextIntegration.detail.configured);
      setStats(dashboard.stats);
      setConversations(inbox.conversations);
      applyReels(reelList.reels);
      setActivity(activityList.activity.length ? activityList.activity : dashboard.recentActivity);
      setSettings(normalizeSettings(nextSettings));
      setAiEnabledState(nextSettings ? nextStatus.aiEnabled : nextStatus.aiEnabled);
      setBackendAvailable(true);
      setBackendError(null);
    } catch (error) {
      setBackendAvailable(false);
      setBackendError(errorMessage(error));
    }
  }, [applyReels]);

  // Hydrate local preferences first, then replace them with backend data.
  useEffect(() => {
    const persisted = readPersisted();
    if (typeof persisted.aiEnabled === "boolean") setAiEnabledState(persisted.aiEnabled);
    if (persisted.settings) setSettings(normalizeSettings(persisted.settings));
    if (persisted.analyses) setAnalyses(persisted.analyses);
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  // Keep an offline copy so the clearly-labelled demo still works without the API.
  useEffect(() => {
    if (!ready) return;
    try {
      const state: PersistedState = { aiEnabled, settings, analyses };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode). The UI keeps working in memory.
    }
  }, [ready, aiEnabled, settings, analyses]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const setAiEnabled = useCallback(
    (enabled: boolean) => {
      setAiEnabledState(enabled);
      if (!backendAvailable) {
        notify({
          type: "warning",
          title: enabled ? "Assistant enabled locally" : "Assistant paused locally",
          message:
            "The backend is unreachable. This preference is stored in the browser only and cannot send or receive messages.",
        });
        return;
      }
      void api
        .activation(enabled)
        .then((result) => {
          setStatus((current) =>
            current
              ? {
                  ...current,
                  aiEnabled: enabled,
                  deliveryEnabled: result.deliveryEnabled,
                  demo: result.mode === "demo",
                  mode: result.mode,
                }
              : current,
          );
          if (!enabled) {
            notify({
              type: "info",
              title: "AI assistant paused",
              message: "No new replies will be drafted or sent while paused.",
            });
            return;
          }
          if (result.mode === "demo") {
            notify({
              type: "warning",
              title: "Assistant enabled in demo mode",
              message:
                "Drafts can be generated from sample conversations, but no Instagram message will be received or sent.",
            });
          } else if (result.deliveryEnabled) {
            notify({
              type: "success",
              title: "Assistant enabled",
              message:
                "Incoming messages will be handled according to your review and delivery settings.",
            });
          } else {
            notify({
              type: "warning",
              title: "Assistant enabled — delivery still blocked",
              message:
                "Messaging permission is not confirmed for the connected account, so replies are held as drafts.",
            });
          }
        })
        .catch((error) => {
          setAiEnabledState(!enabled);
          notify({
            type: "error",
            title: "Could not change assistant state",
            message: errorMessage(error),
          });
        });
    },
    [backendAvailable, notify],
  );

  const saveSettings = useCallback(
    (next: AssistantSettings) => {
      setSettings(next);
      if (!backendAvailable) {
        notify({
          type: "warning",
          title: "Settings saved in this browser only",
          message: "The backend is unreachable, so these settings were not persisted server-side.",
        });
        return;
      }
      void api
        .updateSettings(next)
        .then((saved) => {
          setSettings(normalizeSettings(saved));
          notify({
            type: "success",
            title: "Assistant settings saved",
            message: "Personality, tone and reply rules were stored by the backend.",
          });
        })
        .catch((error) => {
          notify({
            type: "error",
            title: "Settings were not saved",
            message: errorMessage(error),
          });
        });
    },
    [backendAvailable, notify],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    if (backendAvailable) {
      void api
        .resetSettings()
        .then((saved) => setSettings(normalizeSettings(saved)))
        .catch((error) =>
          notify({
            type: "error",
            title: "Settings were not reset on the server",
            message: errorMessage(error),
          }),
        );
    }
    notify({
      type: "info",
      title: "Settings reset to defaults",
      message: "Default personality and auto-reply rules were restored.",
    });
  }, [backendAvailable, notify]);

  const analyzeReel = useCallback(
    (reelId: string) => {
      setAnalyzing((prev) => (prev.includes(reelId) ? prev : [...prev, reelId]));

      if (!backendAvailable) {
        window.setTimeout(() => {
          const fallback: ReelInsight = {
            summary:
              "Demo analysis placeholder. The backend is unreachable, so no media was downloaded and no model was called.",
            topics: ["Demo topic"],
            sentiment: "Neutral",
            suggestedReplies: [],
          };
          setAnalyses((prev) => ({ ...prev, [reelId]: fallback }));
          setAnalyzing((prev) => prev.filter((id) => id !== reelId));
          notify({
            type: "warning",
            title: "Offline placeholder analysis",
            message: "No AI model or Instagram request was used. Start the backend for real analysis.",
          });
        }, 900);
        return;
      }

      void (async () => {
        try {
          const result = await api.analyzeReel(reelId);
          if (result.status === "analyzed" && result.analysis) {
            const analysis = result.analysis;
            setReels((prev) =>
              prev.map((reel) =>
                reel.id === reelId
                  ? {
                      ...reel,
                      summary: analysis.summary,
                      topics: analysis.topics,
                      sentiment: analysis.sentiment,
                      suggestedReplies: analysis.suggestedReplies,
                      analysisStatus: "analyzed",
                      analysisSource: analysis.source,
                      analysisModel: analysis.model,
                      mediaAccessed: analysis.mediaAccessed,
                      limitations: analysis.limitations,
                    }
                  : reel,
              ),
            );
            setAnalyses((prev) => ({
              ...prev,
              [reelId]: {
                summary: analysis.summary,
                topics: analysis.topics,
                sentiment: analysis.sentiment,
                suggestedReplies: analysis.suggestedReplies,
              },
            }));
            setAnalyzing((prev) => prev.filter((id) => id !== reelId));
            notify({
              type: "success",
              title:
                analysis.source === "demo_seed" ? "Demo analysis loaded" : "Reel analysed from media",
              message: analysis.mediaAccessed
                ? `Analysis completed with ${analysis.model ?? "the configured model"}.`
                : "Pre-written sample analysis. No video was downloaded or watched.",
            });
            return;
          }

          if (result.status === "unavailable") {
            setAnalyzing((prev) => prev.filter((id) => id !== reelId));
            setReels((prev) =>
              prev.map((reel) =>
                reel.id === reelId
                  ? {
                      ...reel,
                      accessible: false,
                      analysisStatus: "unavailable",
                      inaccessibleReason: result.message,
                    }
                  : reel,
              ),
            );
            notify({
              type: "warning",
              title: "Media unavailable — upload required",
              message: result.message,
            });
            return;
          }

          if (result.status === "failed") {
            setAnalyzing((prev) => prev.filter((id) => id !== reelId));
            notify({ type: "error", title: "Reel analysis failed", message: result.message });
            return;
          }

          // Queued: poll the job only for progress, then reload analysed Reels.
          const jobId = result.jobId;
          if (!jobId) {
            await refresh();
            setAnalyzing((prev) => prev.filter((id) => id !== reelId));
            return;
          }
          for (let attempt = 0; attempt < 40; attempt += 1) {
            await wait(1500);
            const job = await api.job(jobId);
            if (job.status === "succeeded") {
              await refresh();
              notify({
                type: "success",
                title: "Reel analysis finished",
                message: "The worker processed the actual media. Open the Reel to review it.",
              });
              break;
            }
            if (job.status === "failed" || job.status === "dead") {
              notify({
                type: "error",
                title: "Reel analysis failed",
                message: job.lastError || "The background worker could not analyse this media.",
              });
              break;
            }
          }
          setAnalyzing((prev) => prev.filter((id) => id !== reelId));
        } catch (error) {
          setAnalyzing((prev) => prev.filter((id) => id !== reelId));
          notify({ type: "error", title: "Reel analysis failed", message: errorMessage(error) });
        }
      })();
    },
    [backendAvailable, notify, refresh],
  );

  const uploadReel = useCallback(
    async (reelId: string, file: File) => {
      if (!backendAvailable) {
        notify({
          type: "error",
          title: "Upload needs the backend",
          message: "Start the backend and try again. The file was not uploaded.",
        });
        return;
      }
      setUploading((prev) => (prev.includes(reelId) ? prev : [...prev, reelId]));
      try {
        const updated = await api.uploadReel(reelId, file);
        setReels((prev) => prev.map((reel) => (reel.id === reelId ? { ...reel, ...updated } : reel)));
        setAnalyses((prev) => {
          if (!(reelId in prev)) return prev;
          const next = { ...prev };
          delete next[reelId];
          return next;
        });
        notify({
          type: "success",
          title: "Video uploaded",
          message: "Run analysis to process the actual uploaded media.",
        });
      } catch (error) {
        notify({ type: "error", title: "Upload failed", message: errorMessage(error) });
      } finally {
        setUploading((prev) => prev.filter((id) => id !== reelId));
      }
    },
    [backendAvailable, notify],
  );

  const draftReply = useCallback(
    async (conversationId: string, instruction?: string): Promise<DraftResult | null> => {
      const conversation = conversations.find((item) => item.id === conversationId);
      if (backendAvailable) {
        try {
          const draft = await api.draft(conversationId, instruction);
          notify({
            type: draft.warning ? "warning" : "info",
            title:
              draft.source === "model" ? "AI draft generated" : "Template draft generated",
            message:
              draft.warning ||
              "The draft is ready in the composer. It has not been sent to Instagram.",
          });
          return draft;
        } catch (error) {
          notify({ type: "error", title: "Could not generate a draft", message: errorMessage(error) });
          return null;
        }
      }

      const lastReelId = conversation?.messages
        .map((message) => message.reelId)
        .filter(Boolean)
        .at(-1);
      const reel = reels.find((item) => item.id === lastReelId);
      const text = buildDemoReply(settings, {
        topic: reel?.topics[0],
        hasReel: Boolean(reel),
      });
      notify({
        type: "warning",
        title: "Offline template draft",
        message: "Generated in the browser because the backend is unreachable. Nothing was sent.",
      });
      return { text, source: "template", model: null, delivered: false, warning: null };
    },
    [backendAvailable, conversations, notify, reels, settings],
  );

  const sendReply = useCallback(
    async (conversationId: string, text: string): Promise<SendMessageResult | null> => {
      if (!backendAvailable) {
        notify({
          type: "error",
          title: "Reply not sent",
          message: "The backend is unreachable, so no delivery was attempted or claimed.",
        });
        return null;
      }
      try {
        const result = await api.send(conversationId, text);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, result.message],
                  lastMessageAt: new Date().toISOString(),
                }
              : conversation,
          ),
        );
        if (result.delivered) {
          notify({
            type: "success",
            title: "Reply delivered via Instagram",
            message: result.externalId
              ? `Instagram accepted the message (id ${result.externalId}).`
              : "Instagram accepted the message.",
          });
        } else {
          notify({
            type: "warning",
            title: "Demo reply stored — not sent",
            message:
              result.warning ||
              "This message exists only in the demo workspace. No delivery is claimed.",
          });
        }
        return result;
      } catch (error) {
        notify({ type: "error", title: "Reply not sent", message: errorMessage(error) });
        return null;
      }
    },
    [backendAvailable, notify],
  );

  const markRead = useCallback(
    (conversationId: string) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation,
        ),
      );
      if (backendAvailable) {
        void api.markRead(conversationId).catch(() => {
          // The unread badge is cosmetic; a failed read-receipt is non-fatal.
        });
      }
    },
    [backendAvailable],
  );

  const resetDemo = useCallback(() => {
    if (backendAvailable) {
      void api
        .resetDemo()
        .then(async () => {
          await refresh();
          notify({
            type: "success",
            title: "Demo workspace reset",
            message: "Sample conversations, Reels and activity were restored from the backend.",
          });
        })
        .catch((error) =>
          notify({ type: "error", title: "Demo reset failed", message: errorMessage(error) }),
        );
      return;
    }

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setAiEnabledState(false);
    setSettings(DEFAULT_SETTINGS);
    setAnalyses({});
    setConversations(DEMO_CONVERSATIONS);
    setReels(DEMO_REELS);
    setActivity(DEMO_ACTIVITY);
    setStats(DEMO_STATS);
    setNotifications(
      SEED_NOTIFICATIONS.map((n) => ({ ...n, id: `${n.id}-${Date.now()}`, read: false })),
    );
    notify({
      type: "warning",
      title: "Local demo reset",
      message: "The backend was unreachable, so only browser demo state was cleared.",
    });
  }, [backendAvailable, notify, refresh]);

  const connectInstagram = useCallback(async () => {
    if (!backendAvailable) {
      notify({
        type: "error",
        title: "Backend is unreachable",
        message:
          "Instagram OAuth runs on the backend. Start it before trying to connect an account.",
      });
      return;
    }
    try {
      const result = await api.connectUrl();
      if (!result.configured || !result.url) {
        notify({
          type: "warning",
          title: "Instagram OAuth is not configured",
          message: result.missing.length
            ? `Missing backend variables: ${result.missing.join(", ")}.`
            : result.message,
        });
        return;
      }
      notify({
        type: "info",
        title: "Opening Instagram authorization",
        message:
          "Only Business or Creator accounts are supported by Meta's official messaging API.",
      });
      window.location.assign(result.url);
    } catch (error) {
      notify({
        type: "error",
        title: "Could not start Instagram authorization",
        message: errorMessage(error),
      });
    }
  }, [backendAvailable, notify]);

  const runIntegrationAction = useCallback(
    async (
      action: () => Promise<{ message: string; demo: boolean }>,
      successTitle: string,
    ) => {
      if (!backendAvailable) {
        notify({
          type: "error",
          title: "Backend is unreachable",
          message: "Integration changes require the backend service.",
        });
        return;
      }
      try {
        const result = await action();
        await refresh();
        notify({
          type: result.demo ? "warning" : "success",
          title: successTitle,
          message: result.message,
        });
      } catch (error) {
        notify({
          type: "error",
          title: `${successTitle} failed`,
          message: errorMessage(error),
        });
      }
    },
    [backendAvailable, notify, refresh],
  );

  const verifyIntegration = useCallback(
    () => runIntegrationAction(() => api.verifyIntegration(), "Instagram connection checked"),
    [runIntegrationAction],
  );

  const subscribeWebhooks = useCallback(
    () => runIntegrationAction(() => api.subscribeWebhooks(), "Webhook subscription updated"),
    [runIntegrationAction],
  );

  const disconnectInstagram = useCallback(
    () =>
      runIntegrationAction(
        () => api.disconnect(),
        "Stored Instagram credentials removed",
      ),
    [runIntegrationAction],
  );

  const connection = status?.connection ?? CONNECTION;
  const mode = status?.mode ?? "demo";

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      backendAvailable,
      backendError,
      mode,
      status,
      connection,
      integration,
      oauthConfigured,
      connectInstagram,
      verifyIntegration,
      subscribeWebhooks,
      disconnectInstagram,
      conversations,
      reels,
      activity,
      stats,
      aiEnabled,
      setAiEnabled,
      settings,
      saveSettings,
      resetSettings,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      notify,
      dismissNotification,
      markAllRead,
      analyses,
      analyzing,
      uploading,
      analyzeReel,
      uploadReel,
      draftReply,
      sendReply,
      markRead,
      refresh,
      resetDemo,
    }),
    [
      ready,
      backendAvailable,
      backendError,
      mode,
      status,
      connection,
      integration,
      oauthConfigured,
      connectInstagram,
      verifyIntegration,
      subscribeWebhooks,
      disconnectInstagram,
      conversations,
      reels,
      activity,
      stats,
      aiEnabled,
      setAiEnabled,
      settings,
      saveSettings,
      resetSettings,
      notifications,
      notify,
      dismissNotification,
      markAllRead,
      analyses,
      analyzing,
      uploading,
      analyzeReel,
      uploadReel,
      draftReply,
      sendReply,
      markRead,
      refresh,
      resetDemo,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside <AppProvider>");
  return context;
}
