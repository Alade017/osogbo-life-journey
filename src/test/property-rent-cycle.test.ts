import { describe, expect, it } from "vitest";
import {
  getRentCycleStatus,
  getRentCycleTiming,
  rentRescueInstallment,
} from "@/lib/property-rent-cycle";

describe("property rent cycle", () => {
  const due = new Date("2026-10-17T12:00:00.000Z");
  const timing = getRentCycleTiming(due);
  it("uses a three-day grace period and a one-day rescue offer", () => {
    expect(getRentCycleStatus(timing, new Date("2026-10-17T11:59:59.000Z"))).toBe("current");
    expect(getRentCycleStatus(timing, new Date("2026-10-18T12:00:00.000Z"))).toBe("grace");
    expect(getRentCycleStatus(timing, new Date("2026-10-20T12:00:00.000Z"))).toBe("rescue");
    expect(getRentCycleStatus(timing, new Date("2026-10-21T12:00:00.000Z"))).toBe("repossessed");
  });
  it("caps a rescue loan at four non-compounding instalments", () => {
    expect(rentRescueInstallment(7_000)).toBe(1_750);
    expect(rentRescueInstallment(7_001)).toBe(1_751);
  });
});
