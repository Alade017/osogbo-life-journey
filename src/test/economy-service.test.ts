import { describe, expect, it } from "vitest";
import {
  amountError,
  careerShiftPay,
  ECONOMY_ASSUMPTIONS,
  moneySummary,
  purchaseTotal,
  recoveryBudget,
  shopIsOpen,
  transactionTitle,
} from "@/lib/economy-service";

describe("economy service", () => {
  it("summarizes cash and bank funds without producing negative balances", () => {
    expect(moneySummary(2400, 7000)).toEqual({ cash: 2400, bank: 7000, total: 9400 });
    expect(moneySummary(-1, null)).toEqual({ cash: 0, bank: 0, total: 0 });
  });

  it("validates whole, positive transfers against the source account", () => {
    expect(amountError(0)).toContain("greater than zero");
    expect(amountError(1.5)).toContain("whole amount");
    expect(amountError(2501, 2500)).toContain("available balance");
    expect(amountError(2500, 2500)).toBeNull();
  });

  it("calculates a purchase before submitting it", () => {
    expect(purchaseTotal(1200, 2, 3000)).toEqual({ total: 2400, error: null });
    expect(purchaseTotal(1200, 3, 3000).error).toContain("enough cash");
    expect(purchaseTotal(1200, 0, 3000).error).toContain("quantity");
  });

  it("uses transaction types where available and falls back to descriptions", () => {
    expect(transactionTitle("deposit", "Deposit at bank")).toBe("Bank deposit");
    expect(transactionTitle("income", "Completed Driver at Oja Oba", "job")).toBe("Job pay");
    expect(transactionTitle("income", "Wallet transfer", "withdrawal")).toBe("Income");
    expect(transactionTitle("unknown", "Job shift")).toBe("Job shift");
  });

  it("checks regular and overnight shop hours", () => {
    expect(shopIsOpen(true, 8, 20, 8)).toBe(true);
    expect(shopIsOpen(true, 8, 20, 20)).toBe(false);
    expect(shopIsOpen(true, 22, 6, 2)).toBe(true);
    expect(shopIsOpen(false, 8, 20, 12)).toBe(false);
  });

  it("keeps a starter rental, food, fare, and recovery shift affordable", () => {
    expect(ECONOMY_ASSUMPTIONS.starterCash).toBe(0);
    expect(ECONOMY_ASSUMPTIONS.weeklyStarterRent).toBeLessThan(ECONOMY_ASSUMPTIONS.entryShiftPay);
    expect(recoveryBudget(1)).toEqual({ income: 3500, essentials: 1750, remaining: 1750 });
    expect(recoveryBudget(2).remaining).toBeGreaterThanOrEqual(
      ECONOMY_ASSUMPTIONS.localTransportFare,
    );
    expect(recoveryBudget(8).remaining).toBeGreaterThanOrEqual(ECONOMY_ASSUMPTIONS.phoneUpgrade);
    expect(() => recoveryBudget(-1)).toThrow(RangeError);
  });

  it("applies explicit promotion pay rates without fractional Naira", () => {
    expect(careerShiftPay(3500, 1)).toBe(3500);
    expect(careerShiftPay(3500, 2)).toBe(3850);
    expect(careerShiftPay(3500, 3)).toBe(4200);
    expect(careerShiftPay(3501, 2)).toBe(3851);
    expect(() => careerShiftPay(3500, 4)).toThrow(RangeError);
  });
});
