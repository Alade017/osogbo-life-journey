import housingData from "@/data/housing.json";

export type IncomeBand = "low" | "medium" | "high";

export type ExtraRequirement =
  | { type: "job_income_band"; value: IncomeBand }
  | { type: "income_sources_at_least"; value: number };

export type HouseType = {
  id: string;
  name: string;
  description: string;
  bedrooms: number;
  floors: number;
  shared_facilities: boolean;
  weekly_rent_minor: number;
  min_weekly_income_minor: number;
  preference_tags: string[];
  deposit_weeks: number;
  art_key: string;
  verify: boolean;
  placeholder: boolean;
  extra_requirements: { any_of: ExtraRequirement[] }[];
  home_slots?: { id: string; slot_type: string; x: number; y: number; z?: number }[];
  walkable_area?: {
    x: number;
    y: number;
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
  };
};

export type HousingPlayer = {
  weekly_job_income_minor: number;
  weekly_recurring_income_minor: number;
  wallet_balance_minor: number;
  job_income_band?: IncomeBand | null;
  income_source_count: number;
  preference_tags?: readonly string[];
};

export type HouseEligibility = {
  eligible: boolean;
  reason: "ok" | "income_too_low" | "cannot_cover_deposit" | "preference_mismatch";
};

export const HOUSING = housingData as unknown as readonly HouseType[];

function meetsRequirement(player: HousingPlayer, requirement: ExtraRequirement): boolean {
  if (requirement.type === "job_income_band") {
    return player.job_income_band === requirement.value;
  }
  return player.income_source_count >= requirement.value;
}

function preferenceMatchCount(tags: readonly string[], preferences: readonly string[]): number {
  return preferences.reduce((count, preference) => count + Number(tags.includes(preference)), 0);
}

export function getHouseEligibility(player: HousingPlayer, house: HouseType): HouseEligibility {
  const weeklyIncome = player.weekly_job_income_minor + player.weekly_recurring_income_minor;
  if (weeklyIncome < house.min_weekly_income_minor) {
    return { eligible: false, reason: "income_too_low" };
  }

  const extraRequirementsMet = (house.extra_requirements ?? []).every((group) =>
    group.any_of.some((requirement) => meetsRequirement(player, requirement)),
  );
  if (!extraRequirementsMet) return { eligible: false, reason: "income_too_low" };

  const requiredDeposit = house.deposit_weeks * house.weekly_rent_minor;
  if (player.wallet_balance_minor < requiredDeposit) {
    return { eligible: false, reason: "cannot_cover_deposit" };
  }

  const preferences = player.preference_tags ?? [];
  if (preferences.length > 0 && preferenceMatchCount(house.preference_tags, preferences) === 0) {
    return { eligible: false, reason: "preference_mismatch" };
  }

  return { eligible: true, reason: "ok" };
}

export type RecommendedHouse = {
  house: HouseType;
  eligible: boolean;
  reason: HouseEligibility["reason"];
  preference_match_count: number;
};

export function getRecommendedHouses(
  player: HousingPlayer,
  preferences: readonly string[],
): RecommendedHouse[] {
  return HOUSING.map((house) => {
    const eligibility = getHouseEligibility({ ...player, preference_tags: preferences }, house);
    return {
      house,
      ...eligibility,
      preference_match_count: preferenceMatchCount(house.preference_tags, preferences),
    };
  }).sort(
    (a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      b.preference_match_count - a.preference_match_count ||
      a.house.weekly_rent_minor - b.house.weekly_rent_minor,
  );
}
