import { describe, expect, it, vi, beforeEach } from "vitest";
const { session, from } = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: session }, from },
}));
import {
  canonicalHomeOptions,
  minimumFoodPrice,
  parseHousingCost,
  readFoodCost,
} from "@/lib/living-cost-service";
const home = {
  propertyId: "p",
  tenure: "rented",
  weeklyRentMinor: 3500,
  status: "grace",
  dueAt: "2026-10-25T10:00:00Z",
};
beforeEach(() => vi.restoreAllMocks());
describe("living cost boundaries", () => {
  it("retains weekly units, status and due date", () => {
    expect(parseHousingCost(home)).toMatchObject({
      weeklyRent: 3500,
      owned: false,
      status: "grace",
      dueAt: home.dueAt,
    });
  });
  it("distinguishes owned and no current home", () => {
    expect(parseHousingCost(null)).toBeNull();
    expect(parseHousingCost({ propertyId: "p", tenure: "owned" })).toMatchObject({
      owned: true,
      weeklyRent: null,
    });
  });
  it.each([
    undefined,
    {},
    { ...home, weeklyRentMinor: undefined },
    { ...home, weeklyRentMinor: -1 },
    { ...home, weeklyRentMinor: NaN },
    { ...home, weeklyRentMinor: 1.5 },
    { ...home, tenure: "other" },
    { ...home, dueAt: "bad" },
  ])("rejects malformed housing instead of inventing zero: %j", (input) => {
    expect(() => parseHousingCost(input)).toThrow();
  });
  it("limits menu minimum to available vendors", () => {
    expect(
      minimumFoodPrice(
        [{ id: "active" }],
        [
          { vendor_id: "inactive", price_minor: 1 },
          { vendor_id: "active", price_minor: 1800 },
        ],
      ),
    ).toBe(1800);
    expect(minimumFoodPrice([], [])).toBeNull();
  });
  it.each([0, -1, "1800", Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid menu price %s",
    (price) => {
      expect(() =>
        minimumFoodPrice([{ id: "v" }], [{ vendor_id: "v", price_minor: price }]),
      ).toThrow();
    },
  );
  it("reads only active vendor and menu rows", async () => {
    const eq = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "v" }] })
      .mockResolvedValueOnce({ data: [{ vendor_id: "v", price_minor: 1800 }] });
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });
    expect(await readFoodCost()).toBe(1800);
    expect(eq.mock.calls).toEqual([
      ["active", true],
      ["active", true],
    ]);
  });
  it("does not disguise missing tables as empty catalogs", async () => {
    from.mockReturnValue({ select: () => ({ eq: async () => ({ error: new Error("missing") }) }) });
    await expect(readFoodCost()).rejects.toThrow("Menu unavailable");
  });
  it("uses authenticated GET and a character-scoped housing cache", async () => {
    session.mockResolvedValue({ data: { session: { access_token: "fixture" } } });
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, json: async () => home } as Response);
    const options = canonicalHomeOptions("c");
    expect(options.queryKey).toEqual(["canonicalHousingHome", "c"]);
    // Query functions accept a context; this read does not consume it.
    await (options.queryFn as () => Promise<unknown>)();
    expect(fetcher).toHaveBeenCalledWith("/api/housing/current-home", {
      headers: { Authorization: "Bearer fixture" },
    });
  });
});
