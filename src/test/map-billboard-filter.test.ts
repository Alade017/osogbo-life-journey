import { describe, expect, it } from "vitest";
import { getCurrentMapBillboards } from "@/lib/map-billboard-map";
import type { Advertisement, GameBillboard, Location } from "@/lib/game";

const location = { id: "location-cedar", slug: "cedar-bank" } as Location;
const board = {
  id: "billboard-1",
  name: "Cedar Bank Board",
  location_id: location.id,
  status: "active",
} as GameBillboard;

function ad(id: string, overrides: Partial<Advertisement> = {}): Advertisement {
  return {
    id,
    billboard_id: board.id,
    advertiser_name: `Advertiser ${id}`,
    title: "A current offer",
    description: "Campaign description",
    creative_image_url: null,
    creative_theme: "green",
    call_to_action: "Learn more",
    destination_action: "none",
    destination_url: null,
    slug: id,
    starts_at: "2026-01-01T00:00:00.000Z",
    ends_at: "2099-01-01T00:00:00.000Z",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Advertisement;
}

describe("map billboard campaign filtering", () => {
  it("shows one active campaign per mapped place and counts additional active campaigns", () => {
    const entries = getCurrentMapBillboards(
      [board],
      [ad("active-1"), ad("active-2"), ad("expired", { ends_at: "2026-01-02T00:00:00.000Z" })],
      [],
      [location],
      Date.parse("2026-06-01T00:00:00.000Z"),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.landmarkId).toBe("cedar-bank");
    expect(entries[0]?.count).toBe(2);
    expect(["active-1", "active-2"]).toContain(entries[0]?.advertisement.id);
  });

  it("hides campaigns outside their active window and on inactive billboards", () => {
    const entries = getCurrentMapBillboards(
      [{ ...board, status: "inactive" }],
      [
        ad("not-started", { starts_at: "2099-01-01T00:00:00.000Z" }),
        ad("inactive", { status: "paused" }),
      ],
      [],
      [location],
      Date.parse("2026-06-01T00:00:00.000Z"),
    );
    expect(entries).toEqual([]);
  });
});
