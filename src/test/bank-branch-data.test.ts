import { describe, expect, it } from "vitest";
import { BANK_BRANCH_STAFF, isBankSlug } from "@/lib/bank-branch-data";
import townData from "@/data/osogbo-town.json";

describe("named bank branches", () => {
  it("only exposes the two bank branches already defined in the town data", () => {
    const frontendBankSlugs = townData.landmarks
      .filter((landmark) => landmark.buildingType === "bank")
      .map((landmark) => landmark.locationSlug)
      .sort();
    expect(Object.keys(BANK_BRANCH_STAFF).sort()).toEqual(frontendBankSlugs);
    expect(isBankSlug("cedar-bank")).toBe(true);
    expect(isBankSlug("meridian-bank")).toBe(true);
    expect(isBankSlug("osun-bank")).toBe(false);
  });

  it("keeps the branch staff distinct", () => {
    const cedarStaff = BANK_BRANCH_STAFF["cedar-bank"].map((staff) => staff.name);
    const meridianStaff = BANK_BRANCH_STAFF["meridian-bank"].map((staff) => staff.name);

    expect(cedarStaff).toContain("Teller Ayo");
    expect(meridianStaff).toContain("Teller Kunle");
    expect(new Set([...cedarStaff, ...meridianStaff]).size).toBe(6);
  });
});
