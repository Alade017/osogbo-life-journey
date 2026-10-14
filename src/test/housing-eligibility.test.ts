import { describe, expect, it } from "vitest";
import {
  getHouseEligibility,
  getRecommendedHouses,
  HOUSING,
  type HousingPlayer,
} from "@/game/housing/eligibility";

const basePlayer: HousingPlayer = {
  weekly_job_income_minor: 0,
  weekly_recurring_income_minor: 0,
  wallet_balance_minor: 1_000_000,
  income_source_count: 1,
};

describe("housing eligibility", () => {
  it("accepts income exactly at the stated threshold", () => {
    const house = HOUSING.find((candidate) => candidate.id === "single-room")!;
    const player = { ...basePlayer, weekly_job_income_minor: house.min_weekly_income_minor };

    expect(getHouseEligibility(player, house)).toEqual({ eligible: true, reason: "ok" });
  });

  it("rejects a deposit that is short by one naira", () => {
    const house = HOUSING.find((candidate) => candidate.id === "studio-flat")!;
    const requiredDeposit = house.deposit_weeks * house.weekly_rent_minor;
    const player = {
      ...basePlayer,
      weekly_job_income_minor: house.min_weekly_income_minor,
      wallet_balance_minor: requiredDeposit - 1,
    };

    expect(getHouseEligibility(player, house)).toEqual({
      eligible: false,
      reason: "cannot_cover_deposit",
    });
  });

  it("requires a high-band job or multiple income sources for a duplex", () => {
    const duplex = HOUSING.find((candidate) => candidate.id === "duplex")!;
    const player = {
      ...basePlayer,
      weekly_job_income_minor: duplex.min_weekly_income_minor,
      job_income_band: "medium" as const,
      income_source_count: 1,
    };

    expect(getHouseEligibility(player, duplex)).toEqual({
      eligible: false,
      reason: "income_too_low",
    });
    expect(getHouseEligibility({ ...player, income_source_count: 2 }, duplex).eligible).toBe(true);
  });

  it("does not recommend a family home as eligible when none meets the family player's income", () => {
    const recommendations = getRecommendedHouses(
      { ...basePlayer, weekly_job_income_minor: 10_000 },
      ["family"],
    );
    const eligibleFamilyHouses = recommendations.filter(
      ({ house, eligible }) => eligible && house.preference_tags.includes("family"),
    );

    expect(eligibleFamilyHouses).toHaveLength(0);
    expect(recommendations.find(({ house }) => house.id === "bungalow")?.reason).toBe(
      "income_too_low",
    );
  });
});
