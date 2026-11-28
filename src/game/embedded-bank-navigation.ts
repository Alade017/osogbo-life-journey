import { BANK_INTERIORS, type BankInteriorVariant } from "./bank-interiors";
import { buildBankWorld, bankObstaclePolygons } from "./bank-world-layout";
import { createBankNavigation } from "./bank-lobby-navigation";
import type { VenueFixture } from "@/lib/location-venue-designs";
import type { WalkPoint } from "./grid-walk-path";

const EMBEDDED_BOUNDS = { halfWidth: 6, halfDepth: 4.5 } as const;

/** Navigation is derived from the same blocking parts rendered by the bank scene. */
export function createEmbeddedBankNavigation(variant: BankInteriorVariant) {
  const branch = variant === "teller-hall" ? "cedar-bank" : "meridian-bank";
  const world = buildBankWorld(branch, "hall");
  const bounds = BANK_INTERIORS[variant];
  const scaleX = bounds.width / world.width;
  const scaleZ = bounds.depth / world.depth;
  const transform = ([x, z]: WalkPoint): WalkPoint => [x * scaleX, z * scaleZ];
  const polygons = bankObstaclePolygons(world).map((polygon) => polygon.map(transform));
  const navigation = createBankNavigation(polygons, EMBEDDED_BOUNDS);
  const spawn = transform(world.spawn);
  const targetFor = (fixture: VenueFixture): WalkPoint | null => {
    const action = fixture.kind === "seat" ? "seat" : "teller";
    const preferred = fixture.id.includes("info") || fixture.id.includes("kiosk")
      ? world.fixtures.find((item) => item.id === "ticket")
      : world.fixtures.find((item) => item.action === action && item.id.startsWith(action === "seat" ? "seat-" : "teller-"));
    const target = preferred ?? world.fixtures.find((item) => item.action === action);
    if (!target) return null;
    const point = transform(target.point);
    return navigation.nearest(point);
  };
  return {
    navigation,
    spawn: [spawn[0], 0.06, spawn[1]] as [number, number, number],
    approach: (from: WalkPoint, fixture: VenueFixture) => {
      const target = targetFor(fixture);
      return target ? navigation.route(from, target) : null;
    },
  };
}
