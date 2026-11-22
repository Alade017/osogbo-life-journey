import { describe, expect, it } from "vitest";
import { DISTRICT_FEATURES, featureLabel } from "@/game/district-features";
import { STREET_SIZE } from "@/game/district-streets";
import { neighborhoodAreaForLocation, type NeighborhoodArea } from "@/game/neighborhood-model";

const DISTRICTS = Object.keys(DISTRICT_FEATURES);

function streetFor(slug: string): NeighborhoodArea {
  return neighborhoodAreaForLocation({ slug, name: slug, map_category: "commercial" });
}

function box(x: number, y: number, width: number, height: number) {
  return { left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 };
}

function overlaps(a: ReturnType<typeof box>, b: ReturnType<typeof box>) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe("district feature blocks", () => {
  it("covers every district that has features", () => {
    expect(DISTRICTS).toHaveLength(20);
  });

  it.each(DISTRICTS)("shows every feature of %s as a block", (slug) => {
    const blocks =
      streetFor(slug).obstacles?.filter((o) => o.id.startsWith("district-feature-")) ?? [];
    expect(blocks.map((b) => b.label)).toEqual(DISTRICT_FEATURES[slug]!.map(featureLabel));
  });

  it.each(DISTRICTS)("keeps %s's blocks inside the street and clear of everything else", (slug) => {
    const area = streetFor(slug);
    const blocks = area.obstacles!.filter((o) => o.id.startsWith("district-feature-"));
    const others = area.obstacles!.filter((o) => !o.id.startsWith("district-feature-"));
    for (const block of blocks) {
      const footprint = box(block.x, block.y, block.width, block.height);
      expect(footprint.left).toBeGreaterThanOrEqual(0);
      expect(footprint.top).toBeGreaterThanOrEqual(0);
      expect(footprint.right).toBeLessThanOrEqual(STREET_SIZE.width);
      expect(footprint.bottom).toBeLessThanOrEqual(STREET_SIZE.height);
      for (const road of area.roads ?? []) {
        const half = road.width / 2;
        const strip =
          road.axis === "vertical"
            ? box(road.offset, STREET_SIZE.height / 2, 2 * half, STREET_SIZE.height)
            : box(STREET_SIZE.width / 2, road.offset, STREET_SIZE.width, 2 * half);
        expect(overlaps(footprint, strip), `${slug} ${block.label} on road ${road.id}`).toBe(false);
      }
      for (const other of others) {
        expect(
          overlaps(footprint, box(other.x, other.y, other.width, other.height)),
          `${slug} ${block.label} on ${other.id}`,
        ).toBe(false);
      }
      for (const object of area.objects) {
        expect(
          Math.hypot(object.x - block.x, object.y - block.y),
          `${slug} ${block.label} by ${object.id}`,
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it.each(DISTRICTS)("builds the same street for %s every time", (slug) => {
    expect(streetFor(slug).obstacles).toEqual(streetFor(slug).obstacles);
  });

  it("title-cases a feature for its label", () => {
    expect(featureLabel("textile workshop")).toBe("Textile Workshop");
    expect(featureLabel("Art gallery")).toBe("Art Gallery");
  });
});

describe("district houses", () => {
  it("places several houses beside the roads of every district, clear of other blocks", async () => {
    const { HOUSE_BLOCK } = await import("@/game/district-streets");
    for (const slug of DISTRICTS) {
      const area = streetFor(slug);
      const houses = (area.obstacles ?? []).filter((o) => o.id.startsWith("district-house-"));
      expect(houses.length, slug).toBeGreaterThanOrEqual(4);
      for (const house of houses) {
        expect(house.kind).toBe("compound");
        expect(house.width).toBe(HOUSE_BLOCK.width);
        const footprint = box(house.x, house.y, house.width, house.height);
        for (const road of area.roads ?? []) {
          const strip =
            road.axis === "vertical"
              ? box2(
                  road.offset - road.width / 2,
                  0,
                  road.offset + road.width / 2,
                  STREET_SIZE.height,
                )
              : box2(
                  0,
                  road.offset - road.width / 2,
                  STREET_SIZE.width,
                  road.offset + road.width / 2,
                );
          expect(overlapsBox(footprint, strip), `${slug} ${house.id} on road`).toBe(false);
        }
      }
    }
  });
});

function box2(left: number, top: number, right: number, bottom: number) {
  return { left, top, right, bottom };
}

function overlapsBox(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
