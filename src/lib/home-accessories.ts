export type HomeBudgetBand = "basic" | "comfortable" | "premium";
export function getHomeBudgetBand(budgetMinor: number): HomeBudgetBand {
  if (!Number.isSafeInteger(budgetMinor) || budgetMinor < 0) throw new Error("INVALID_HOME_BUDGET");
  return budgetMinor >= 20_000 ? "premium" : budgetMinor >= 5_000 ? "comfortable" : "basic";
}
export function validateMoveInBudget(requestedMinor: number, availableMinor: number) {
  if (
    !Number.isSafeInteger(requestedMinor) ||
    requestedMinor < 0 ||
    requestedMinor > availableMinor
  )
    throw new Error("ACCESSORY_BUDGET_UNAFFORDABLE");
  return getHomeBudgetBand(requestedMinor);
}
export function rentReliefShiftPay(unpaidRentMinor: number) {
  if (!Number.isSafeInteger(unpaidRentMinor) || unpaidRentMinor <= 0)
    throw new Error("INVALID_RENT_AMOUNT");
  return Math.ceil(unpaidRentMinor / 3);
}
