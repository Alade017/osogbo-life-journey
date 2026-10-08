export type MoneySummary = {
  cash: number;
  bank: number;
  total: number;
};

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
