import { describe, expect, it } from "vitest";
import {
  getHomeBudgetBand,
  rentReliefShiftPay,
  validateMoveInBudget,
} from "@/lib/home-accessories";
describe("home accessories and rent relief", () => {
  it("chooses a budget band and rejects cash the player does not have", () => {
    expect(getHomeBudgetBand(0)).toBe("basic");
    expect(validateMoveInBudget(5_000, 5_000)).toBe("comfortable");
    expect(validateMoveInBudget(20_000, 20_000)).toBe("premium");
    expect(() => validateMoveInBudget(5_001, 5_000)).toThrow("ACCESSORY_BUDGET_UNAFFORDABLE");
  });
  it("splits rent relief across three shifts", () => expect(rentReliefShiftPay(7_001)).toBe(2_334));
});
