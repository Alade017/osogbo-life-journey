export type MoneySummary = {
  cash: number;
  bank: number;
  total: number;
};

/** Fictional in-game NGN assumptions aligned with the seeded item, property, and job catalogs. */
export const ECONOMY_ASSUMPTIONS = Object.freeze({
  currency: "NGN game value",
  starterCash: 0,
  weeklyStarterRent: 450,
  basicFood: 1200,
  localTransportFare: 100,
  entryShiftPay: 3500,
  entryShiftSkillXp: 8,
  phoneUpgrade: 25000,
});

export function recoveryBudget(shiftCount: number) {
  if (!Number.isSafeInteger(shiftCount) || shiftCount < 0)
    throw new RangeError("Shift count must be a non-negative whole number.");
  const income = shiftCount * ECONOMY_ASSUMPTIONS.entryShiftPay;
  const essentials =
    ECONOMY_ASSUMPTIONS.weeklyStarterRent +
    ECONOMY_ASSUMPTIONS.basicFood +
    ECONOMY_ASSUMPTIONS.localTransportFare;
  return { income, essentials, remaining: income - essentials };
}

export function careerShiftPay(baseSalary: number, careerLevel: number): number {
  if (!Number.isSafeInteger(baseSalary) || baseSalary < 0) return 0;
  if (!Number.isInteger(careerLevel) || careerLevel < 1 || careerLevel > 3)
    throw new RangeError("Career level must be between 1 and 3.");
  return baseSalary + Math.floor((baseSalary * (careerLevel - 1)) / 10);
}

export function moneySummary(
  cash: number | null | undefined,
  bank: number | null | undefined,
): MoneySummary {
  const safeCash = Math.max(0, Number(cash ?? 0));
  const safeBank = Math.max(0, Number(bank ?? 0));
  return { cash: safeCash, bank: safeBank, total: safeCash + safeBank };
}

export function amountError(amount: number, available?: number): string | null {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    return "Enter a whole amount greater than zero.";
  if (available !== undefined && amount > available)
    return "That amount exceeds your available balance.";
  return null;
}

export function purchaseTotal(unitPrice: number, quantity: number, availableCash: number) {
  if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0)
    return { total: 0, error: "This item is not for sale." };
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99)
    return { total: 0, error: "Choose a quantity from 1 to 99." };
  const total = unitPrice * quantity;
  if (!Number.isSafeInteger(total)) return { total: 0, error: "That total is too large." };
  if (total > availableCash) return { total, error: "You do not have enough cash." };
  return { total, error: null };
}

export function transactionTitle(type: string, fallback: string, category?: string | null) {
  if (type === "income" && category === "job") return "Job pay";
  const names: Record<string, string> = {
    deposit: "Bank deposit",
    withdrawal: "Bank withdrawal",
    purchase: "Shop purchase",
    sale: "Item sale",
    income: "Income",
    expense: "Expense",
  };
  return names[type] ?? fallback;
}

export function shopIsOpen(open: boolean, openingHour: number, closingHour: number, hour: number) {
  if (!open || hour < 0 || hour > 23 || openingHour === closingHour) return false;
  return openingHour < closingHour
    ? hour >= openingHour && hour < closingHour
    : hour >= openingHour || hour < closingHour;
}
