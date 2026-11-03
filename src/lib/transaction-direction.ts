export type TransactionDirection = "credit" | "debit";

type TransactionLike = {
  kind: string;
  category: string;
  amount: number;
};

/**
 * Amounts are always stored as positive numbers, so direction comes from the
 * bank's point of view:
 * - deposit (cash into bank) is a credit
 * - withdrawal (bank into cash) is a debit
 * - everything else follows `kind`: income = credit, expense = debit
 */
export function transactionDirection(tx: TransactionLike): TransactionDirection {
  if (tx.category === "deposit") return "credit";
  if (tx.category === "withdrawal") return "debit";
  return tx.kind === "income" ? "credit" : "debit";
}

/** "+₦5,000" for credits and "-₦5,000" for debits. */
export function formatSignedAmount(tx: TransactionLike, format: (n: number) => string) {
  const sign = transactionDirection(tx) === "credit" ? "+" : "-";
  return `${sign}${format(Math.abs(tx.amount))}`;
}

/** Green for credits, red for debits (light and dark mode). */
export function directionTextClass(tx: TransactionLike) {
  return transactionDirection(tx) === "credit"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}