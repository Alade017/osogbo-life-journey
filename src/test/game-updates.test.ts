import { describe, expect, it } from "vitest";
import { sortGameUpdates, toGameUpdate, type GameUpdate } from "@/lib/game-updates";

const updates: GameUpdate[] = [
  { id: "a", title: "A", summary: "a", app: "Map", publishedOn: "2026-11-01" },
  { id: "b", title: "B", summary: "b", app: "Map", publishedOn: "2026-11-09" },
  { id: "c", title: "C", summary: "c", app: "Map", publishedOn: "2026-10-30" },
];

describe("game updates", () => {
  it("lists the newest update first", () => {
    const dates = sortGameUpdates(updates).map((update) => update.publishedOn);
    expect(dates).toEqual(["2026-11-09", "2026-11-01", "2026-10-30"]);
  });

  it("respects the limit", () => {
    expect(sortGameUpdates(updates, 1)).toHaveLength(1);
  });

  it("maps a database row to the phone's update shape", () => {
    expect(
      toGameUpdate({
        id: "x",
        title: "Osun Gist",
        summary: "Headlines",
        app: "Osun Gist",
        published_on: "2026-11-09",
      }),
    ).toEqual({
      id: "x",
      title: "Osun Gist",
      summary: "Headlines",
      app: "Osun Gist",
      publishedOn: "2026-11-09",
    });
  });
});
