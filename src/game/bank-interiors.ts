/** Authored presentation layouts only; account eligibility and transactions stay server-owned. */
export const BANK_INTERIORS = {
  "teller-hall": { width: 12, depth: 9, tellerWindows: [-2.3, 0, 2.3], queueRows: [-0.1, 1.2, 2.5] },
  "digital-lounge": { width: 12, depth: 9, kioskOffsets: [-0.65, 0.65], loungeAngles: [Math.PI / 2, -Math.PI / 2] },
} as const;
export type BankInteriorVariant = keyof typeof BANK_INTERIORS;
