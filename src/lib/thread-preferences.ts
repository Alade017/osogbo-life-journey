import { supabase } from "@/integrations/supabase/client";
import { stripFormat } from "@/shared/format/inline-format";
import type { Json } from "@/integrations/supabase/types";

export type MuteDuration = "8h" | "1w" | "always";
export type ThreadCommand = "pin" | "unpin" | "mute" | "unmute" | "read" | "star" | "unstar";
export type ThreadSummary = {
  id: string;
  character_id: string;
  player_name: string;
  gender: string;
  appearance: Json;
  level: number;
  created_at: string;
  lastActivity: string;
  preview: string;
  unreadCount: number;
  pinnedAt: string | null;
  mutedUntil: string | null;
  starredAt: string | null;
};

type QueuedThreadAction = {
  id: string;
  threadId: string;
  command: ThreadCommand;
  duration?: MuteDuration;
};

const QUEUE_KEY = "osun-life-thread-actions-v1";
const queueKey = (accountId: string) => `osun-life-thread-actions-v2:${accountId}`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const commands = new Set(["pin", "unpin", "mute", "unmute", "read", "star", "unstar"]);
const durations = new Set(["8h", "1w", "always"]);
const flushes = new Map<string, Promise<{ sent: number; remaining: number }>>();

function validAction(item: unknown): item is QueuedThreadAction {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const row = item as Record<string, unknown>;
  return (
    typeof row["id"] === "string" &&
    uuidPattern.test(row["id"]) &&
    typeof row["threadId"] === "string" &&
    uuidPattern.test(row["threadId"]) &&
    typeof row["command"] === "string" &&
    commands.has(row["command"]) &&
    (row["command"] === "mute"
      ? typeof row["duration"] === "string" && durations.has(row["duration"])
      : row["duration"] === undefined)
  );
}

async function actionSession(expectedAccountId?: string) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.user?.id)
    throw new Error(expectedAccountId ? "CHAT_ACCOUNT_CHANGED" : "Sign in to manage chats.");
  if (expectedAccountId && session.user.id !== expectedAccountId)
    throw new Error("CHAT_ACCOUNT_CHANGED");
  return { accountId: session.user.id, token: session.access_token };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid thread response.");
  return value as Record<string, unknown>;
}

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseSummary(value: unknown): ThreadSummary {
  const row = record(value);
  return {
    id: string(row["id"]),
    character_id: string(row["character_id"]),
    player_name: string(row["player_name"]),
    gender: string(row["gender"], "nonbinary"),
    appearance: (row["appearance"] ?? {}) as Json,
    level: typeof row["level"] === "number" ? row["level"] : 1,
    created_at: string(row["created_at"]),
    lastActivity: string(row["last_activity"]),
    preview: stripFormat(string(row["preview"])),
    unreadCount: Math.max(0, Number(row["unread_count"] ?? 0)),
    pinnedAt: typeof row["pinned_at"] === "string" ? row["pinned_at"] : null,
    mutedUntil: typeof row["muted_until"] === "string" ? row["muted_until"] : null,
    starredAt: typeof row["starred_at"] === "string" ? row["starred_at"] : null,
  };
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to manage chats.");
  return token;
}

export async function getThreadSummaries(): Promise<ThreadSummary[]> {
  const response = await fetch("/api/threads/", {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Your chats could not be loaded.");
  if (!Array.isArray(value)) throw new Error("Invalid chat list response.");
  return value.map(parseSummary);
}

function readQueue(accountId: string): QueuedThreadAction[] {
  try {
    localStorage.removeItem(QUEUE_KEY); // Ownerless legacy intent cannot safely be replayed.
    const value: unknown = JSON.parse(localStorage.getItem(queueKey(accountId)) ?? "[]");
    const actions = Array.isArray(value) ? value.filter(validAction) : [];
    writeQueue(accountId, actions);
    return actions;
  } catch {
    return [];
  }
}

function writeQueue(accountId: string, value: QueuedThreadAction[]) {
  localStorage.setItem(queueKey(accountId), JSON.stringify(value));
}

async function sendThreadAction(action: QueuedThreadAction, accountId: string) {
  const { token } = await actionSession(accountId);
  const method = ["unpin", "unmute", "unstar"].includes(action.command) ? "DELETE" : "POST";
  const endpoint = action.command.replace(/^un/, "");
  const response = await fetch(`/api/threads/${action.threadId}/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": action.id,
    },
    ...(action.command === "mute" ? { body: JSON.stringify({ duration: action.duration }) } : {}),
  });
  const value = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
  if (!response.ok) throw new Error(value?.error?.code ?? "THREAD_ACTION_FAILED");
  return value;
}

export async function runThreadAction(
  threadId: string,
  command: ThreadCommand,
  duration?: MuteDuration,
  expectedAccountId?: string,
) {
  const { accountId } = await actionSession(expectedAccountId);
  const action = { id: crypto.randomUUID(), threadId, command, ...(duration ? { duration } : {}) };
  if (!validAction(action)) throw new Error("INVALID_THREAD_ACTION");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    writeQueue(accountId, [...readQueue(accountId), action]);
    return { queued: true };
  }
  try {
    return await sendThreadAction(action, accountId);
  } catch (error) {
    if (error instanceof TypeError) {
      await actionSession(accountId);
      writeQueue(accountId, [...readQueue(accountId), action]);
      return { queued: true };
    }
    throw error;
  }
}

export async function flushThreadActionQueue(
  onRejected?: (message: string) => void,
  expectedAccountId?: string,
) {
  const { accountId } = await actionSession(expectedAccountId);
  const existing = flushes.get(accountId);
  if (existing) return existing;
  const flush = async () => {
    let sent = 0;
    for (const action of readQueue(accountId)) {
      try {
        await actionSession(accountId);
      } catch {
        break;
      }
      try {
        await sendThreadAction(action, accountId);
        sent++;
      } catch (error) {
        if (
          error instanceof TypeError ||
          (error instanceof Error && error.message === "CHAT_ACCOUNT_CHANGED")
        )
          break;
        onRejected?.(error instanceof Error ? error.message : "THREAD_ACTION_FAILED");
      }
      // Re-read to retain actions enqueued while the network request was pending.
      writeQueue(
        accountId,
        readQueue(accountId).filter((entry) => entry.id !== action.id),
      );
    }
    return { sent, remaining: readQueue(accountId).length };
  };
  const pending = flush().finally(() => flushes.delete(accountId));
  flushes.set(accountId, pending);
  return pending;
}

/** One body-free Realtime channel per account, throttled to two updates per thread per second. */
export function subscribeToInboxSummaries(accountId: string, onThread: (threadId: string) => void) {
  const last = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const emit = (threadId: string) => {
    const elapsed = Date.now() - (last.get(threadId) ?? 0);
    if (elapsed >= 500) {
      last.set(threadId, Date.now());
      onThread(threadId);
      return;
    }
    if (timers.has(threadId)) return;
    timers.set(
      threadId,
      setTimeout(() => {
        timers.delete(threadId);
        last.set(threadId, Date.now());
        onThread(threadId);
      }, 500 - elapsed),
    );
  };
  const channel = supabase
    .channel(`social-inbox:${accountId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "social_inbox_events",
        filter: `account_id=eq.${accountId}`,
      },
      (payload) => {
        const threadId = (payload.new as { thread_id?: unknown }).thread_id;
        if (typeof threadId === "string") emit(threadId);
      },
    )
    .subscribe();
  return {
    channel,
    clear() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}
