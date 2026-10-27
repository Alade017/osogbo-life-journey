import { beforeEach, describe, it, expect, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { readStallIncome, claimStallIncome } from "@/lib/stall-income-service";
const id = "11111111-1111-4111-8111-111111111111",
  tx = "22222222-2222-4222-8222-222222222222";
const snapshot = {
  serverTime: "2026-10-27T12:00:00Z",
  asOf: "2026-10-27T12:00:00Z",
  date: "2026-10-27",
  ratePerHour: 10,
  dailyCap: 100,
  retainedDates: 7,
  policyVersion: 1,
  hasStall: true,
  enrolled: true,
  isOpen: true,
  claimable: 10,
  todayEarned: 10,
  todayPaid: 0,
  lastReceipt: null,
};
const receipt = {
  requestId: id,
  amount: 10,
  cash: 110,
  transactionId: tx,
  claimedAt: snapshot.asOf,
  policyVersion: 1,
  duplicate: false,
};
beforeEach(() => rpc.mockReset());
describe("stall income service", () => {
  it("reads server estimates and submits only a request UUID", async () => {
    rpc.mockResolvedValueOnce({ data: snapshot }).mockResolvedValueOnce({ data: receipt });
    expect(await readStallIncome()).toEqual(snapshot);
    expect(await claimStallIncome(id)).toEqual(receipt);
    expect(rpc.mock.calls).toEqual([
      ["get_stall_income"],
      ["claim_stall_income", { p_request_id: id }],
    ]);
  });
  it.each([
    { claimable: 701 },
    { todayEarned: 101 },
    { todayPaid: 11 },
    { ratePerHour: 20 },
    { enrolled: false, isOpen: true },
    { hasStall: false },
    { asOf: "invalid" },
  ])("rejects corrupt or contradictory estimates %j", async (patch) => {
    rpc.mockResolvedValue({ data: { ...snapshot, ...patch } });
    await expect(readStallIncome()).rejects.toThrow("unavailable");
  });
  it("rejects mismatched receipts and positive payouts without transaction proof", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ...receipt, requestId: tx } })
      .mockResolvedValueOnce({ data: { ...receipt, transactionId: null } });
    await expect(claimStallIncome(id)).rejects.toThrow("not confirmed");
    await expect(claimStallIncome(id)).rejects.toThrow("not confirmed");
  });
  it("accepts stable zero and duplicate receipts without inventing a payment", async () => {
    rpc.mockResolvedValue({
      data: { ...receipt, amount: 0, transactionId: null, duplicate: true },
    });
    expect(await claimStallIncome(id)).toMatchObject({
      amount: 0,
      duplicate: true,
      transactionId: null,
    });
  });
  it("handles a missing migration without exposing raw backend errors", async () => {
    rpc.mockResolvedValue({ error: { code: "PGRST202", message: "function missing" } });
    await expect(readStallIncome()).rejects.toThrow("not available yet");
  });
});
