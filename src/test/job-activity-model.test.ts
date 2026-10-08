import { describe, expect, it } from "vitest";
import {
  ACTIVITY_CATEGORIES,
  JOB_CATEGORIES,
  parseJobActivityRequirements,
  resolveJobCategory,
} from "@/lib/job-activity-model";

describe("job and activity data model", () => {
  it("exposes the initial extensible job and activity categories", () => {
    expect(JOB_CATEGORIES).toContain("technology");
    expect(JOB_CATEGORIES).toContain("food_hospitality");
    expect(ACTIVITY_CATEGORIES).toContain("rest");
    expect(ACTIVITY_CATEGORIES).toContain("exploration");
  });

  it("uses stored job categories and falls back for older catalog rows", () => {
    expect(resolveJobCategory("technology", "custom_role", "Custom Role")).toBe("technology");
    expect(resolveJobCategory(undefined, "waiter", "Waiter")).toBe("food_hospitality");
    expect(resolveJobCategory(undefined, "apprentice_barber", "Apprentice Barber")).toBe(
      "services",
    );
  });

  it("normalizes supported job and activity requirement metadata", () => {
    expect(
      parseJobActivityRequirements({
        level: 2,
        skills: [{ slug: "javascript", minimum_level: 1, minimum_experience: 20 }],
        items: ["tool-kit", ""],
        minimum_reputation: 5,
        location_slug: "student-district",
        available_hours: { start: 8, end: 18 },
      }),
    ).toEqual({
      level: 2,
      skills: [{ slug: "javascript", minimumLevel: 1, minimumExperience: 20 }],
      items: ["tool-kit"],
      minimumReputation: 5,
      locationSlug: "student-district",
      availableHours: { start: 8, end: 18 },
    });
  });

  it("ignores malformed requirement values safely", () => {
    expect(
      parseJobActivityRequirements({
        level: -1,
        skills: [{ slug: "", minimum_level: -2 }],
        available_hours: { start: 22, end: 22 },
      }),
    ).toEqual({
      level: undefined,
      skills: [],
      items: undefined,
      minimumReputation: undefined,
      locationSlug: undefined,
      availableHours: undefined,
    });
    expect(parseJobActivityRequirements([])).toEqual({});
  });
});
