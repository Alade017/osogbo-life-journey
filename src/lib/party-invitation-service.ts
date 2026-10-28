import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
const uuid = z.string().uuid();
const status = z.enum(["pending", "accepted", "declined"]);
const stamp = z.string().datetime({ offset: true });
const item = z
  .object({
    id: uuid,
    eventId: uuid,
    title: z.string(),
    hostName: z.string(),
    recipientName: z.string(),
    recipientCharacterId: uuid.nullable(),
    venue: z.string(),
    startsAt: stamp,
    endsAt: stamp,
    status,
    phase: z.enum(["scheduled", "live", "ended", "cancelled"]),
    isGuest: z.boolean(),
    canRespond: z.boolean(),
  })
  .strict()
  .refine(
    (v) =>
      (v.status === "accepted") === v.isGuest &&
      (!v.canRespond || (v.status === "pending" && ["scheduled", "live"].includes(v.phase))),
  );
const page = z
  .object({ serverTime: stamp, items: z.array(item).max(20), nextCursor: uuid.nullable() })
  .strict();
const confirmation = z
  .object({
    requestId: uuid,
    invitationId: uuid,
    eventId: uuid,
    status,
    isNew: z.boolean(),
    confirmedAt: stamp,
    duplicate: z.boolean(),
  })
  .strict();
export type PartyInvitation = z.infer<typeof item>;
export type InvitationIntent =
  | { kind: "send"; eventId: string; recipientCharacterId: string }
  | { kind: "respond"; eventId: string; invitationId: string; decision: "accepted" | "declined" };
export const invitationKey = (accountId: string, eventId?: string) =>
  ["partyInvitations", accountId, eventId ?? "inbox"] as const;
async function session(accountId: string) {
  const { data } = await supabase.auth.getSession();
  if (!accountId || data.session?.user.id !== accountId)
    throw new Error("Sign in to manage invitations.");
}
function failure(error: { code?: string; message: string }) {
  if (error.code === "PGRST202")
    return new Error(
      "Invitations are not available yet. Existing party activities are still usable.",
    );
  const code = error.message.match(
    /\b(?:REGISTERED_ACCOUNT_REQUIRED|INVITATION_UNAVAILABLE|INVALID_RECIPIENT|PLAYER_BLOCKED|EVENT_NOT_ACCEPTING_INVITATIONS|INVITATION_ALREADY_RESOLVED|EVENT_INVITATION_LIMIT|INVITATION_RATE_LIMIT|REQUEST_ID_REUSED)\b/,
  )?.[0];
  const messages: Record<string, string> = {
    PLAYER_BLOCKED: "This invitation is unavailable because a player is blocked.",
    EVENT_NOT_ACCEPTING_INVITATIONS: "This event has ended or was cancelled.",
    INVITATION_ALREADY_RESOLVED:
      "This invitation already has a confirmed response. Refresh the list.",
    EVENT_INVITATION_LIMIT: "This event has reached its invitation limit.",
    INVITATION_RATE_LIMIT: "Too many new invitations. Wait a minute and retry.",
  };
  return new Error(
    (code && messages[code]) || "The invitation could not be confirmed. Refresh or retry.",
  );
}
export async function listPartyInvitations(
  accountId: string,
  eventId?: string,
  after: string | null = null,
) {
  if ((eventId && !uuid.safeParse(eventId).success) || (after && !uuid.safeParse(after).success))
    throw new Error("Invalid invitation page.");
  await session(accountId);
  const { data, error } = await supabase.rpc("get_party_invitations", {
    ...(eventId ? { p_event_id: eventId } : {}),
    ...(after ? { p_after: after } : {}),
    p_limit: 20,
  });
  await session(accountId);
  if (error) throw failure(error);
  const result = page.safeParse(data);
  if (
    !result.success ||
    new Set(result.data.items.map((v) => v.id)).size !== result.data.items.length ||
    (eventId && result.data.items.some((v) => v.eventId !== eventId)) ||
    (after && result.data.items.some((v) => v.id <= after)) ||
    (result.data.nextCursor && result.data.nextCursor !== result.data.items.at(-1)?.id)
  )
    throw new Error("Invitation data is unavailable. Refresh and try again.");
  return result.data;
}
export async function performInvitation(
  accountId: string,
  intent: InvitationIntent,
  requestId: string,
) {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    throw new Error("Connect to manage invitations. Nothing was queued.");
  uuid.parse(requestId);
  uuid.parse(intent.eventId);
  if (intent.kind === "send") uuid.parse(intent.recipientCharacterId);
  else uuid.parse(intent.invitationId);
  await session(accountId);
  const { data, error } = await supabase.rpc("party_invitation_action", {
    p_kind: intent.kind,
    p_request_id: requestId,
    ...(intent.kind === "send"
      ? { p_event_id: intent.eventId, p_recipient_character_id: intent.recipientCharacterId }
      : { p_invitation_id: intent.invitationId, p_decision: intent.decision }),
  });
  await session(accountId);
  if (error) throw failure(error);
  const result = confirmation.safeParse(data);
  if (
    !result.success ||
    result.data.requestId !== requestId ||
    result.data.eventId !== intent.eventId ||
    (intent.kind === "respond" &&
      (result.data.invitationId !== intent.invitationId || result.data.status !== intent.decision))
  )
    throw new Error("The invitation response was not confirmed. Retry the same request.");
  return result.data;
}
