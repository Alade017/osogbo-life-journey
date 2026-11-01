import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
export type MessageAttachment = { filename: string; mimeType: string; size: number };
export type SocialProfileCard = {
  characterId: string;
  name: string;
  gender: string;
  appearance: Json;
  level: number;
  isOwn: boolean;
  isFriend: boolean;
  coverUrl: string | null;
  status: { body: string; theme: string; expiresAt: string } | null;
};
export function validateMedia(file: File, cover = false) {
  if (!file.size || file.size > MEDIA_MAX_BYTES)
    throw new Error("Choose a file between 1 byte and 10 MB.");
  if (!(cover ? MEDIA_ACCEPT.split(",").slice(0, 3) : MEDIA_ACCEPT.split(",")).includes(file.type))
    throw new Error(
      cover ? "Choose a JPEG, PNG or WebP image." : "Choose a JPEG, PNG, WebP image or PDF.",
    );
}
export async function socialMediaRequest(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("Sign in again to use messaging.");
  const response = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${session.access_token}` },
  });
  const result = await response.json().catch(() => null);
  const latest = await supabase.auth.getSession();
  if (latest.data.session?.user.id !== session.user.id)
    throw new Error("Your account changed. Reopen the conversation.");
  if (!response.ok) {
    const messages: Record<string, string> = {
      UNKNOWN_THREAD: "This conversation is no longer available.",
      MESSAGE_RATE_LIMIT: "You are sending messages too quickly. Wait a moment and retry.",
      MEDIA_RATE_LIMIT: "You have uploaded several files recently. Try again later.",
      MEDIA_TOO_LARGE: "Choose a file smaller than 10 MB.",
      UNSUPPORTED_MEDIA: "Choose a JPEG, PNG, WebP image or PDF.",
      IDEMPOTENCY_CONFLICT: "This upload could not be retried. Cancel and choose the file again.",
    };
    throw new Error(
      messages[String(result?.error?.code)] ?? "Messaging media is unavailable. Try again.",
    );
  }
  return result;
}
export async function uploadSocialMedia(file: File, requestId: string, threadId?: string) {
  validateMedia(file, !threadId);
  const form = new FormData();
  form.set("file", file);
  form.set("purpose", threadId ? "attachment" : "cover");
  if (threadId) form.set("threadId", threadId);
  return socialMediaRequest("/api/messages/media/", {
    method: "POST",
    headers: { "Idempotency-Key": requestId },
    body: form,
  });
}
