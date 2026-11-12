import { supabase } from "@/integrations/supabase/client";

/** The five reactions a member can use. The database enforces the same list. */
export const GROUP_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏"] as const;
export type GroupReaction = (typeof GROUP_REACTIONS)[number];

/** A group chat the signed-in player belongs to, as get_social_groups_overview returns it. */
export type SocialGroup = {
  id: string;
  name: string;
  memberCount: number;
  memberNames: string[];
  lastBody: string | null;
  lastMessageAt: string;
  pinned: boolean;
  muted: boolean;
};

export type GroupReactionSummary = { emoji: GroupReaction; count: number; mine: boolean };

export type SocialGroupMessage = {
  id: string;
  kind: "text" | "voice" | "image";
  body: string | null;
  durationMs: number | null;
  createdAt: string;
  senderCharacterId: string;
  senderName: string;
  reactions: GroupReactionSummary[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReaction(value: unknown): value is GroupReaction {
  return typeof value === "string" && (GROUP_REACTIONS as readonly string[]).includes(value);
}

function parseGroup(value: unknown): SocialGroup | null {
  if (!isRecord(value)) return null;
  const id = value["id"];
  const name = value["name"];
  const lastMessageAt = value["last_message_at"];
  if (typeof id !== "string" || typeof name !== "string" || typeof lastMessageAt !== "string") {
    return null;
  }
  const memberNames = value["member_names"];
  return {
    id,
    name,
    memberCount: typeof value["member_count"] === "number" ? value["member_count"] : 0,
    memberNames: Array.isArray(memberNames)
      ? memberNames.filter((item): item is string => typeof item === "string")
      : [],
    lastBody: typeof value["last_body"] === "string" ? value["last_body"] : null,
    lastMessageAt,
    pinned: typeof value["pinned_at"] === "string",
    muted: value["muted"] === true,
  };
}

function parseReactions(value: unknown): GroupReactionSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || !isReaction(item["emoji"])) return [];
    return [
      {
        emoji: item["emoji"],
        count: typeof item["count"] === "number" ? item["count"] : 0,
        mine: item["mine"] === true,
      },
    ];
  });
}

function parseMessage(value: unknown): SocialGroupMessage | null {
  if (!isRecord(value)) return null;
  const id = value["id"];
  const kind = value["kind"];
  const senderId = value["sender_character_id"];
  const senderName = value["sender_name"];
  const createdAt = value["created_at"];
  if (
    typeof id !== "string" ||
    (kind !== "text" && kind !== "voice" && kind !== "image") ||
    typeof senderId !== "string" ||
    typeof senderName !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }
  return {
    id,
    kind,
    body: typeof value["body"] === "string" ? value["body"] : null,
    durationMs: typeof value["duration_ms"] === "number" ? value["duration_ms"] : null,
    createdAt,
    senderCharacterId: senderId,
    senderName,
    reactions: parseReactions(value["reactions"]),
  };
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to continue.");
  return token;
}

export async function fetchSocialGroups(): Promise<SocialGroup[]> {
  const { data, error } = await supabase.rpc("get_social_groups_overview");
  if (error) throw new Error(error.message);
  return Array.isArray(data)
    ? data.map(parseGroup).filter((group): group is SocialGroup => group !== null)
    : [];
}

export async function fetchSocialGroupMessages(groupId: string): Promise<SocialGroupMessage[]> {
  const { data, error } = await supabase.rpc("get_social_group_messages", {
    p_group_id: groupId,
    p_limit: 50,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data)
    ? data.map(parseMessage).filter((message): message is SocialGroupMessage => message !== null)
    : [];
}

export async function createSocialGroup(name: string, memberCharacterIds: string[]) {
  const { data, error } = await supabase.rpc("create_social_group", {
    p_name: name,
    p_member_character_ids: memberCharacterIds,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function sendSocialGroupMessage(groupId: string, body: string, requestId: string) {
  const { data, error } = await supabase.rpc("send_social_group_message", {
    p_group_id: groupId,
    p_body: body,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Uploads a voice note through the group endpoint. The server applies the private-chat limits. */
export async function sendGroupVoice(input: {
  groupId: string;
  blob: Blob;
  durationMs: number;
  requestId: string;
}) {
  const form = new FormData();
  form.set("groupId", input.groupId);
  form.set("durationMs", String(input.durationMs));
  form.set("file", input.blob, "voice-note.ogg");
  return groupUpload("/api/groups/voice/", form, input.requestId);
}

/** Uploads a picture (JPEG, PNG or WebP, up to 10 MB). */
export async function sendGroupPicture(input: { groupId: string; file: File; requestId: string }) {
  const form = new FormData();
  form.set("groupId", input.groupId);
  form.set("file", input.file, input.file.name);
  return groupUpload("/api/groups/media/", form, input.requestId);
}

async function groupUpload(path: string, form: FormData, requestId: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Idempotency-Key": requestId },
    body: form,
  });
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string };
  } | null;
  if (!response.ok) throw new Error(body?.error?.code ?? "UPLOAD_FAILED");
  return body;
}

/** A short-lived link to a member's voice note or picture. */
export async function getGroupMediaUrl(messageId: string) {
  const response = await fetch(`/api/groups/media/${messageId}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  const body = (await response.json().catch(() => null)) as { url?: unknown } | null;
  if (!response.ok || typeof body?.url !== "string") throw new Error("MEDIA_UNAVAILABLE");
  return body.url;
}

export async function toggleGroupReaction(messageId: string, emoji: GroupReaction) {
  const { data, error } = await supabase.rpc("toggle_social_group_reaction", {
    p_message_id: messageId,
    p_emoji: emoji,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function setGroupPrefs(groupId: string, pinned: boolean, muted: boolean) {
  const { data, error } = await supabase.rpc("set_social_group_prefs", {
    p_group_id: groupId,
    p_pinned: pinned,
    p_muted: muted,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function addSocialGroupMember(groupId: string, characterId: string) {
  const { error } = await supabase.rpc("add_social_group_member", {
    p_group_id: groupId,
    p_character_id: characterId,
  });
  if (error) throw new Error(error.message);
}

export async function leaveSocialGroup(groupId: string) {
  const { error } = await supabase.rpc("leave_social_group", { p_group_id: groupId });
  if (error) throw new Error(error.message);
}
