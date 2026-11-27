/** Bounds for embedded callers. Full branch geometry lives in bank-world-layout. */
export const BANK_INTERIORS = {
  "teller-hall": { width: 12, depth: 9 },
  "digital-lounge": { width: 12, depth: 9 },
} as const;
export type BankInteriorVariant = keyof typeof BANK_INTERIORS;
