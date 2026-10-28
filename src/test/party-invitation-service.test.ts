import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { rpc, getSession } = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, auth: { getSession } } }));
import {
  listPartyInvitations,
  performInvitation,
  type InvitationIntent,
} from "@/lib/party-invitation-service";
const user = "11111111-1111-4111-8111-111111111111",
  event = "22222222-2222-4222-8222-222222222222",
  target = "33333333-3333-4333-8333-333333333333",
  invite = "44444444-4444-4444-8444-444444444444",
  request = "55555555-5555-4555-8555-555555555555";
const stamp = "2026-10-28T12:00:00Z";
const row = {
  id: invite,
  eventId: event,
  title: "Gathering",
  hostName: "Ade",
  recipientName: "Bisi",
  recipientCharacterId: target,
  venue: "Lantern Hall",
  startsAt: stamp,
  endsAt: "2026-10-28T15:00:00Z",
  status: "pending",
  phase: "live",
  isGuest: false,
  canRespond: true,
};
const confirmation = {
  requestId: request,
  invitationId: invite,
  eventId: event,
  status: "accepted",
  isNew: false,
  confirmedAt: stamp,
  duplicate: false,
};
const intent: InvitationIntent = {
  kind: "respond",
  eventId: event,
  invitationId: invite,
  decision: "accepted",
};
beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: user } } } });
  rpc
    .mockReset()
    .mockResolvedValue({ data: { serverTime: stamp, items: [row], nextCursor: null } });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());
it("reads bounded inbox/host pages without a caller account parameter", async () => {
  expect((await listPartyInvitations(user)).items[0]!.hostName).toBe("Ade");
  expect(rpc).toHaveBeenLastCalledWith("get_party_invitations", { p_limit: 20 });
  await listPartyInvitations(user, event);
  expect(rpc).toHaveBeenLastCalledWith("get_party_invitations", { p_event_id: event, p_limit: 20 });
});
it("rejects malformed cursors before calling the database", async () => {
  await expect(listPartyInvitations(user, event, "bad")).rejects.toThrow("Invalid invitation page");
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  { ...row, user_id: user },
  { ...row, status: "accepted", isGuest: false },
  { ...row, phase: "ended", canRespond: true },
])("rejects private or inconsistent projections %j", async (bad) => {
  rpc.mockResolvedValue({ data: { serverTime: stamp, items: [bad], nextCursor: null } });
  await expect(listPartyInvitations(user)).rejects.toThrow("data is unavailable");
});
it("validates confirmed recipient choice and request identity", async () => {
  rpc.mockResolvedValue({ data: confirmation });
  expect((await performInvitation(user, intent, request)).status).toBe("accepted");
  expect(rpc).toHaveBeenLastCalledWith("party_invitation_action", {
    p_kind: "respond",
    p_request_id: request,
    p_invitation_id: invite,
    p_decision: "accepted",
  });
  rpc.mockResolvedValue({ data: { ...confirmation, requestId: target } });
  await expect(performInvitation(user, intent, request)).rejects.toThrow("not confirmed");
});
it("sends a public target character id and preserves the supplied request UUID", async () => {
  rpc.mockResolvedValue({ data: { ...confirmation, status: "pending", isNew: true } });
  await performInvitation(
    user,
    { kind: "send", eventId: event, recipientCharacterId: target },
    request,
  );
  expect(rpc).toHaveBeenLastCalledWith("party_invitation_action", {
    p_kind: "send",
    p_request_id: request,
    p_event_id: event,
    p_recipient_character_id: target,
  });
});
it("does not queue or call RPCs offline", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await expect(performInvitation(user, intent, request)).rejects.toThrow("Nothing was queued");
  expect(rpc).not.toHaveBeenCalled();
});
it("discards a response crossing an account switch", async () => {
  getSession
    .mockResolvedValueOnce({ data: { session: { user: { id: user } } } })
    .mockResolvedValueOnce({ data: { session: { user: { id: target } } } });
  await expect(listPartyInvitations(user)).rejects.toThrow("Sign in");
});
it("explains missing migration and authoritative expiry", async () => {
  rpc.mockResolvedValue({ error: { code: "PGRST202", message: "missing" } });
  await expect(listPartyInvitations(user)).rejects.toThrow(
    "Existing party activities are still usable",
  );
  rpc.mockResolvedValue({ error: { message: "EVENT_NOT_ACCEPTING_INVITATIONS" } });
  await expect(performInvitation(user, intent, request)).rejects.toThrow("ended or was cancelled");
});
