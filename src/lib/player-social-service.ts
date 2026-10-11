import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type PlayerProfile = {
  character_id: string;
  player_name: string;
  gender: string;
  appearance: Json;
  level: number;
  relationship: "none" | "request_sent" | "request_received" | "friends";
  request_id: string | null;
};

export type SocialPlayer = Omit<PlayerProfile, "relationship" | "request_id"> & {
  created_at: string;
};

export type SocialOverview = {
  friends: SocialPlayer[];
  incoming: Array<SocialPlayer & { id: string }>;
  outgoing: Array<SocialPlayer & { id: string }>;
  blocked: Array<{ character_id: string; player_name: string; created_at: string }>;
  conversations: Array<SocialPlayer & { id: string }>;
};

export type SocialMessage = {
  id: string;
  sender_character_id: string;
  sender_name: string;
  channel: "area" | "private";
  location_id: string | null;
  conversation_id: string | null;
  body: string;
  created_at: string;
};

export type SocialReportCategory =
  "spam" | "harassment" | "inappropriate_content" | "impersonation" | "other";

function unwrap<T>(response: { data: T | null; error: { message: string } | null }): T {
  if (response.error) throw new Error(response.error.message);
  if (response.data === null) throw new Error("The social request returned no result.");
  return response.data;
}

function object(value: Json, message: string): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value;
}

function string(value: Json | undefined, field: string): string {
  if (typeof value !== "string") throw new Error("Invalid social response: " + field);
  return value;
}

function profile(value: Json): PlayerProfile {
  const row = object(value, "Invalid player profile response.");
  const relationship = string(row["relationship"], "relationship");
  if (
    !(["none", "request_sent", "request_received", "friends"] as const).includes(
      relationship as PlayerProfile["relationship"],
    )
  ) {
    throw new Error("Invalid player relationship response.");
  }
  return {
    character_id: string(row["character_id"], "character_id"),
    player_name: string(row["player_name"], "player_name"),
    gender: string(row["gender"], "gender"),
    appearance: row["appearance"] ?? {},
    level: typeof row["level"] === "number" ? row["level"] : 1,
    relationship: relationship as PlayerProfile["relationship"],
    request_id: typeof row["request_id"] === "string" ? row["request_id"] : null,
  };
}

function player(value: Json): SocialPlayer {
  const row = object(value, "Invalid player list response.");
  return {
    character_id: string(row["character_id"], "character_id"),
    player_name: string(row["player_name"], "player_name"),
    gender: string(row["gender"], "gender"),
    appearance: row["appearance"] ?? {},
    level: typeof row["level"] === "number" ? row["level"] : 1,
    created_at: string(row["created_at"], "created_at"),
  };
}

function playerWithId(value: Json): SocialPlayer & { id: string } {
  const row = object(value, "Invalid social list response.");
  return { ...player(value), id: string(row["id"], "id") };
}

export async function searchPlayerProfiles(query: string) {
  const data = unwrap(
    await supabase.rpc("search_player_profiles", { p_query: query, p_limit: 20 }),
  );
  if (!Array.isArray(data)) throw new Error("Invalid player search response.");
  return data.map(profile);
}

export async function getPlayerProfile(characterId: string) {
  return profile(unwrap(await supabase.rpc("get_player_profile", { p_character_id: characterId })));
}

export async function getPlayerSocialOverview(): Promise<SocialOverview> {
  const row = object(
    unwrap(await supabase.rpc("get_player_social_overview")),
    "Invalid social overview response.",
  );
  const list = (key: string) => {
    const value = row[key];
    if (!Array.isArray(value)) throw new Error("Invalid social response: " + key);
    return value;
  };
  const blocked = list("blocked").map((value) => {
    const entry = object(value, "Invalid blocked player response.");
    return {
      character_id: string(entry["character_id"], "character_id"),
      player_name: string(entry["player_name"], "player_name"),
      created_at: string(entry["created_at"], "created_at"),
    };
  });
  return {
    friends: list("friends").map(player),
    incoming: list("incoming").map(playerWithId),
    outgoing: list("outgoing").map(playerWithId),
    blocked,
    conversations: list("conversations").map(playerWithId),
  };
}

export async function sendFriendRequest(targetCharacterId: string) {
  return unwrap(
    await supabase.rpc("send_player_friend_request", {
      p_target_character_id: targetCharacterId,
      p_request_id: crypto.randomUUID(),
    }),
  );
}

export async function respondToFriendRequest(requestId: string, accept: boolean) {
  return unwrap(
    await supabase.rpc("respond_player_friend_request", {
      p_request_id: requestId,
      p_accept: accept,
    }),
  );
}

export async function cancelFriendRequest(requestId: string) {
  return unwrap(await supabase.rpc("cancel_player_friend_request", { p_request_id: requestId }));
}

export async function removeFriend(targetCharacterId: string) {
  return unwrap(
    await supabase.rpc("remove_player_friend", { p_target_character_id: targetCharacterId }),
  );
}

export async function blockPlayer(targetCharacterId: string) {
  return unwrap(await supabase.rpc("block_player", { p_target_character_id: targetCharacterId }));
}

export async function unblockPlayer(targetCharacterId: string) {
  return unwrap(await supabase.rpc("unblock_player", { p_target_character_id: targetCharacterId }));
}

export async function openPlayerConversation(targetCharacterId: string) {
  const row = object(
    unwrap(
      await supabase.rpc("get_or_create_player_conversation", {
        p_target_character_id: targetCharacterId,
      }),
    ),
    "Invalid private conversation response.",
  );
  return { id: string(row["id"], "id") };
}

export async function sendSocialMessage(input: {
  channel: "area" | "private";
  body: string;
  locationId?: string;
  conversationId?: string;
}) {
  return unwrap(
    await supabase.rpc("send_social_message", {
      p_channel: input.channel,
      p_body: input.body,
      p_request_id: crypto.randomUUID(),
      p_location_id: input.locationId ?? null,
      p_conversation_id: input.conversationId ?? null,
    }),
  );
}

export async function getSocialMessages(input: { locationId?: string; conversationId?: string }) {
  const data = unwrap(
    await supabase.rpc("get_social_messages", {
      p_location_id: input.locationId ?? null,
      p_conversation_id: input.conversationId ?? null,
      p_before: null,
      p_limit: 50,
    }),
  );
  if (!Array.isArray(data)) throw new Error("Invalid chat history response.");
  return data.map((value) => {
    const row = object(value, "Invalid chat message response.");
    return {
      id: string(row["id"], "id"),
      sender_character_id: string(row["sender_character_id"], "sender_character_id"),
      sender_name: string(row["sender_name"], "sender_name"),
      channel: string(row["channel"], "channel") as SocialMessage["channel"],
      location_id: typeof row["location_id"] === "string" ? row["location_id"] : null,
      conversation_id: typeof row["conversation_id"] === "string" ? row["conversation_id"] : null,
      body: string(row["body"], "body"),
      created_at: string(row["created_at"], "created_at"),
    } satisfies SocialMessage;
  });
}

export async function reportPlayer(input: {
  targetCharacterId: string;
  category: SocialReportCategory;
  details?: string;
  messageId?: string;
}) {
  return unwrap(
    await supabase.rpc("report_player", {
      p_target_character_id: input.targetCharacterId,
      p_category: input.category,
      p_details: input.details ?? "",
      p_message_id: input.messageId ?? null,
    }),
  );
}

export function subscribeToSocialMessages(
  filter: { locationId?: string; conversationId?: string },
  onMessage: () => void,
) {
  const key = filter.locationId ? "area:" + filter.locationId : "private:" + filter.conversationId;
  const channel = supabase.channel("social-messages:" + key).on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "social_messages",
      filter: filter.locationId
        ? "location_id=eq." + filter.locationId
        : "conversation_id=eq." + filter.conversationId,
    },
    onMessage,
  );
  return channel.subscribe();
}

export function subscribeToFriendRequests(onChange: () => void) {
  return supabase
    .channel("social-friend-requests")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "player_friend_requests" },
      onChange,
    )
    .subscribe();
}

export async function leaveSocialChannel(channel: ReturnType<typeof subscribeToSocialMessages>) {
  await supabase.removeChannel(channel);
}
