import { describe, expect, it } from "vitest";
import { GAME_UPDATES, latestGameUpdates } from "@/lib/game-updates";

describe("game updates", () => {
  it("lists the newest update first", () => {
    const dates = latestGameUpdates().map((update) => update.publishedOn);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("keeps ids unique so every card has a stable key", () => {
    const ids = GAME_UPDATES.map((update) => update.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respects the limit", () => {
    expect(latestGameUpdates(1)).toHaveLength(1);
  });
});
