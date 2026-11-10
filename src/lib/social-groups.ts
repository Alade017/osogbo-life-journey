import { supabase } from "@/integrations/supabase/client";

/** A group chat the signed-in player belongs to, as get_social_groups_overview returns it. */
export type SocialGroup = {
  id: string;
  name: string;
  memberCount: number;
  memberNames: string[];
  lastBody: string | null;
  lastMessageAt: string;
};

export type SocialGroupMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderCharacterId: string;
  senderName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseGroup(value: unknown): SocialGroup | null {
  if (!isRecord(value)) return null;
  const {
    id,
    name,
    member_count: memberCount,
    member_names: memberNames,
    last_body: lastBody,
  } = value;
  const lastMessageAt = value["last_message_at"];
  if (typeof id !== "string" || typeof name !== "string" || typeof lastMessageAt !== "string") {
    return null;
  }
  return {
    id,
    name,
    memberCount: typeof memberCount === "number" ? memberCount : 0,
    memberNames: Array.isArray(memberNames)
      ? memberNames.filter((item): item is string => typeof item === "string")
      : [],
    lastBody: typeof lastBody === "string" ? lastBody : null,
    lastMessageAt,
  };
}

function parseMessage(value: unknown): SocialGroupMessage | null {
  if (!isRecord(value)) return null;
  const {
    id,
    body,
    created_at: createdAt,
    sender_character_id: senderId,
    sender_name: senderName,
  } = value;
  if (
    typeof id !== "string" ||
    typeof body !== "string" ||
    typeof createdAt !== "string" ||
    typeof senderId !== "string" ||
    typeof senderName !== "string"
  ) {
    return null;
  }
  return { id, body, createdAt, senderCharacterId: senderId, senderName };
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
