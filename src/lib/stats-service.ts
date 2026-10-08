export const STAT_MIN = 0;
export const STAT_MAX = 100;

export const DEFAULT_VITALS = {
  health: 100,
  energy: 100,
  hunger: 20,
  thirst: 20,
} as const;

export type VitalName = keyof typeof DEFAULT_VITALS;
export type Vitals = Record<VitalName, number>;

/** A hunger or thirst value of 100 means the need is urgent. */
export function clampStat(value: number): number {
  if (!Number.isFinite(value)) return STAT_MIN;
  return Math.max(STAT_MIN, Math.min(STAT_MAX, Math.trunc(value)));
}

export function isValidStatValue(value: number): boolean {
  return Number.isInteger(value) && value >= STAT_MIN && value <= STAT_MAX;
}

export function validateVitals(vitals: Vitals): string[] {
  return (Object.keys(DEFAULT_VITALS) as VitalName[]).flatMap((stat) =>
    isValidStatValue(vitals[stat]) ? [] : [`${stat} must be an integer from 0 to 100`],
  );
}

export function setStat(vitals: Vitals, stat: VitalName, value: number): Vitals {
  return { ...vitals, [stat]: clampStat(value) };
}

export function adjustStat(vitals: Vitals, stat: VitalName, amount: number): Vitals {
  if (!Number.isFinite(amount)) return { ...vitals };
  return setStat(vitals, stat, vitals[stat] + Math.trunc(amount));
}

export function resetStat(vitals: Vitals, stat: VitalName): Vitals {
  return { ...vitals, [stat]: DEFAULT_VITALS[stat] };
}

export function resetVitals(): Vitals {
  return { ...DEFAULT_VITALS };
}
