import { describe, expect, it } from "vitest";
import { profileBadges } from "@/lib/profile-badges";

const base = { missionsCompleted: 0, level: 1, reputation: 0, outfitWorn: 0, outfitSlots: 5 };
const byId = (input: Parameters<typeof profileBadges>[0]) =>
  Object.fromEntries(profileBadges(input).map((badge) => [badge.id, badge]));

describe("profile badges", () => {
  it("starts with nothing earned, and shows progress toward each one", () => {
    const badges = byId(base);
    expect(Object.values(badges).some((badge) => badge.earned)).toBe(false);
    expect(badges["mission-runner"]).toMatchObject({ progress: 0, target: 5, earned: false });
  });

  it("earns mission badges at their thresholds", () => {
    const badges = byId({ ...base, missionsCompleted: 5 });
    expect(badges["first-steps"]?.earned).toBe(true);
    expect(badges["mission-runner"]?.earned).toBe(true);
    expect(badges["trailblazer"]?.earned).toBe(false);
    expect(badges["trailblazer"]).toMatchObject({ progress: 5, target: 10 });
  });

  it("caps progress at the target so a badge never shows more than it needs", () => {
    const badges = byId({ ...base, level: 9, reputation: 80 });
    expect(badges["rising-star"]).toMatchObject({ progress: 5, target: 5, earned: true });
    expect(badges["respected"]).toMatchObject({ progress: 50, target: 50, earned: true });
  });

  it("earns Dressed to Impress only with every outfit slot worn", () => {
    expect(byId({ ...base, outfitWorn: 4 })["dressed-up"]?.earned).toBe(false);
    expect(byId({ ...base, outfitWorn: 5 })["dressed-up"]?.earned).toBe(true);
  });

  it("never divides by zero when there are no outfit slots", () => {
    expect(byId({ ...base, outfitSlots: 0 })["dressed-up"]).toMatchObject({ target: 1 });
  });
});
