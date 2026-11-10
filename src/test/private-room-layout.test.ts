import { describe, expect, it } from "vitest";
import { ROOM_VIEW_PALETTE } from "@/components/3d/world-theme";
import {
  HOUSE_ROOM_SIZE,
  HOUSE_ROOM_ID,
  PRIVATE_BATHROOM,
  houseRoomViews,
  housePartitionSegments,
  privateBathroomBounds,
} from "@/components/game/housing/house-room-contract";

const [width, depth] = HOUSE_ROOM_SIZE["single-room"]!;

describe("private room layout", () => {
  it("adds an enclosed bathroom as a second room view, inside the room", () => {
    const views = houseRoomViews("single-room", width, depth);
    expect(views.map((view) => view.id)).toEqual([HOUSE_ROOM_ID.single, HOUSE_ROOM_ID.bathroom]);
    const bath = views[1]!;
    expect(bath.minX).toBeGreaterThanOrEqual(-width / 2);
    expect(bath.maxX).toBeCloseTo(width / 2);
    expect(bath.minZ).toBeCloseTo(0);
    expect(bath.maxZ).toBeCloseTo(depth / 2);
    expect(bath.maxX - bath.minX).toBeCloseTo(width * PRIVATE_BATHROOM.widthFraction);
  });

  it("leaves other house types with a single whole-room view", () => {
    for (const type of ["shared-room", "studio-flat", "mini-flat", "bungalow", "duplex"]) {
      const size = HOUSE_ROOM_SIZE[type];
      if (!size) continue;
      const views = houseRoomViews(type, size[0], size[1]);
      if (
        type === "studio-flat" ||
        type === "mini-flat" ||
        type === "bungalow" ||
        type === "duplex"
      ) {
        expect(views.length).toBeGreaterThan(1);
      } else {
        expect(views).toHaveLength(1);
      }
    }
  });

  it("builds the bathroom walls with a clear doorway in the back wall", () => {
    const segments = housePartitionSegments("single-room", width, depth);
    expect(segments.map((segment) => segment.id)).toEqual([
      "bedroom-bath-side",
      "bath-back-left",
      "bath-back-right",
      "bath-doorway-lintel",
    ]);
    const bath = privateBathroomBounds(width, depth);
    const doorCenter = (bath.minX + bath.maxX) / 2;
    const half = PRIVATE_BATHROOM.doorway / 2;
    // No solid back-wall piece may cover the doorway opening; only the lintel sits above it.
    for (const segment of segments.filter((item) => item.id.startsWith("bath-back"))) {
      const [x] = segment.position;
      const [sizeX] = segment.size;
      const left = x - sizeX / 2;
      const right = x + sizeX / 2;
      const overlaps = right > doorCenter - half && left < doorCenter + half;
      expect(overlaps).toBe(false);
    }
  });

  it("keeps every partition piece inside the room footprint", () => {
    for (const segment of housePartitionSegments("single-room", width, depth)) {
      const [x, , z] = segment.position;
      const [sizeX, , sizeZ] = segment.size;
      expect(x - sizeX / 2).toBeGreaterThanOrEqual(-width / 2 - 1e-9);
      expect(x + sizeX / 2).toBeLessThanOrEqual(width / 2 + 1e-9);
      expect(z - sizeZ / 2).toBeGreaterThanOrEqual(-depth / 2 - 1e-9);
      expect(z + sizeZ / 2).toBeLessThanOrEqual(depth / 2 + 1e-9);
    }
  });
});

describe("studio flat layout", () => {
  const [studioWidth, studioDepth] = HOUSE_ROOM_SIZE["studio-flat"]!;

  it("is one open room with only the bathroom enclosed", () => {
    const views = houseRoomViews("studio-flat", studioWidth, studioDepth);
    expect(views.map((view) => view.id)).toEqual([HOUSE_ROOM_ID.single, HOUSE_ROOM_ID.bathroom]);
    expect(housePartitionSegments("studio-flat", studioWidth, studioDepth)).toHaveLength(4);
  });

  it("uses the blueprint's cream wall tone for the room views", () => {
    expect(ROOM_VIEW_PALETTE.wall).toBe("#e8dcc4");
  });
});
