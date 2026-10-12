import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeBusinessCommand,
  investmentAmountError,
  parseBusinessOverview,
} from "@/lib/business-service";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock }));
const empty = {
  businesses: [],
  companies: [],
  products: [],
  myCompanies: [],
  myInvestments: [],
  myCompanyInvestments: [],
};
describe("business service validation", () => {
  beforeEach(() => mock.rpc.mockReset());
  it("accepts an empty market and rejects malformed arrays", () => {
    expect(parseBusinessOverview(empty)).toEqual(empty);
    expect(() => parseBusinessOverview({ ...empty, companies: {} })).toThrow(/invalid data/);
  });
  it("accepts database timestamps with timezone offsets", () => {
    const data = {
      ...empty,
      myInvestments: [
        {
          id: "investment",
          product: "Susu",
          principal: 10000,
          yieldBps: 200,
          maturesAt: "2026-10-19T09:00:00+00:00",
          claimedAt: null,
        },
      ],
    };
    expect(parseBusinessOverview(data).myInvestments).toHaveLength(1);
  });
  it("rejects invalid or out-of-range whole amounts", () => {
    for (const amount of [NaN, Infinity, 1.2, 9999, 1000001])
      expect(investmentAmountError(amount, 10000, 1000000)).not.toBeNull();
    expect(investmentAmountError(10000, 10000, 1000000)).toBeNull();
  });
  it("uses the caller's unchanged retry request ID", async () => {
    mock.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    const command = { kind: "buy" as const, slug: "studio", requestId: "same-request" };
    await executeBusinessCommand(command);
    await executeBusinessCommand(command);
    expect(mock.rpc.mock.calls[0]).toEqual(mock.rpc.mock.calls[1]);
    expect(mock.rpc).toHaveBeenCalledWith("buy_player_company", {
      p_business_slug: "studio",
      p_request_id: "same-request",
    });
  });
  it("rejects server errors and unconfirmed outcomes", async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "Insufficient cash" } });
    await expect(executeBusinessCommand({ kind: "claimFixed", id: "a" })).rejects.toThrow(
      "Insufficient cash",
    );
    mock.rpc.mockResolvedValueOnce({ data: { ok: false }, error: null });
    await expect(executeBusinessCommand({ kind: "claimFixed", id: "a" })).rejects.toThrow(
      /did not confirm/,
    );
  });
});
