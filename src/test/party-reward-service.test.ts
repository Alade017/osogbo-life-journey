import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { claimPartyHostReward, readPartyHostResults } from "@/lib/party-reward-service";
const eventId = "11111111-1111-4111-8111-111111111111";
const event = {
  eventId,
  title: "Fictional gathering",
  endsAt: "2026-10-26T15:00:00Z",
  claimUntil: "2026-11-02T15:00:00Z",
  requirements: 1,
  completed: 1,
  guests: 2,
  reason: "eligible",
  receipt: null,
};
const snapshot = {
  serverTime: "2026-10-26T16:00:00Z",
  date: "2026-10-26",
  reward: 1,
  events: [event],
};
const receipt = {
  eventId,
  date: "2026-10-26",
  awardedAt: "2026-10-26T16:00:00Z",
  reward: 1,
  reputationDelta: 1,
  reputationAfter: 11,
  newlyAwarded: true,
};
beforeEach(() => rpc.mockReset());
describe("party reward service", () => {
  it("reads server result and sends only event and pinned date", async () => {
    rpc.mockResolvedValueOnce({ data: snapshot }).mockResolvedValueOnce({ data: receipt });
    expect(await readPartyHostResults()).toEqual(snapshot);
    expect(await claimPartyHostReward({ eventId, date: snapshot.date })).toEqual(receipt);
    expect(rpc.mock.calls).toEqual([
      ["get_party_host_results"],
      ["claim_party_host_reward", { p_event_id: eventId, p_date: snapshot.date }],
    ]);
  });
  it.each([
    { ...event, guests: 1 },
    { ...event, completed: 0 },
    { ...event, reason: "invented" },
    { ...event, claimUntil: "invalid" },
    { ...event, receipt },
  ])("rejects contradictory results %j", async (row) => {
    rpc.mockResolvedValue({ data: { ...snapshot, events: [row] } });
    await expect(readPartyHostResults()).rejects.toThrow("unavailable");
  });
  it("rejects unconfirmed/mismatched rewards and accepts a replay from a previous day", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ...receipt, reputationDelta: 2 } })
      .mockResolvedValueOnce({ data: { ...receipt, date: "2026-10-25" } })
      .mockResolvedValueOnce({ data: { ...receipt, date: "2026-10-25", newlyAwarded: false } });
    const input = { eventId, date: snapshot.date };
    await expect(claimPartyHostReward(input)).rejects.toThrow("not confirmed");
    await expect(claimPartyHostReward(input)).rejects.toThrow("not confirmed");
    expect(await claimPartyHostReward(input)).toMatchObject({ newlyAwarded: false });
  });
  it("handles missing migrations and midnight rejection without changing the command", async () => {
    rpc
      .mockResolvedValueOnce({ error: { code: "PGRST202", message: "missing" } })
      .mockResolvedValueOnce({ error: { message: "STALE_DATE" } });
    await expect(readPartyHostResults()).rejects.toThrow("not available yet");
    await expect(claimPartyHostReward({ eventId, date: snapshot.date })).rejects.toThrow(
      "Lagos day changed",
    );
  });
});
