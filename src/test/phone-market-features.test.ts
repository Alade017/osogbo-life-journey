import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import map from "@/data/osogbo-town.json";
import { getItemArt } from "@/lib/item-art";

const migration = readFileSync(
  join(process.cwd(), "drizzle/migrations/0049_phone_market_and_careers.sql"),
  "utf8",
);

describe("phone and market feature contracts", () => {
  it("adds Osun Mall as a verified supermarket map landmark", () => {
    const landmark = map.landmarks.find((item) => item.id === "osun-mall");
    expect(landmark).toMatchObject({ label: "Osun Mall", category: "market", verify: true });
    expect(map.grid.buildings.some((item) => item.placeId === "osun-mall")).toBe(true);
  });

  it("keeps billboard edits and statuses behind authenticated RPCs", () => {
    expect(migration).toContain("update_player_advertisement");
    expect(migration).toContain("owner_user_id=uid");
    expect(migration).toContain("player_status_friends_read");
    expect(migration).toContain("expires_at timestamptz");
  });

  it("enforces bulk minimums and idempotent shop purchases on the server", () => {
    expect(migration).toContain("minimum_quantity");
    expect(migration).toContain("_validate_shop_minimum");
    expect(migration).toContain("economy_request_results");
  });

  it("returns artwork only for catalogued item assets", () => {
    expect(getItemArt("computer")).toBe("/assets/items/computer.webp");
    expect(getItemArt("missing-item")).toBeNull();
  });
});
