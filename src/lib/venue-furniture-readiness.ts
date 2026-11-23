import type { VenueFixture } from "@/lib/location-venue-designs";
import { VENUE_FURNITURE } from "@/lib/venue-furniture-assets";

export type FurnitureResult = "ready" | "failed";

export type FurnitureResults = Readonly<Record<string, FurnitureResult | undefined>>;

export function getFurnitureKey(fixture: VenueFixture): string {
  return JSON.stringify([fixture.id, fixture.kind, VENUE_FURNITURE[fixture.kind]?.url ?? null]);
}

export function summarizeFurnitureReadiness(
  fixtures: readonly VenueFixture[],
  results: FurnitureResults,
) {
  let pending = 0;
  let ready = 0;
  let failed = 0;

  for (const fixture of fixtures) {
    if (!VENUE_FURNITURE[fixture.kind]) continue;

    const status = results[getFurnitureKey(fixture)];

    switch (status) {
      case "ready":
        ready++;
        break;
      case "failed":
        failed++;
        break;
      default:
        pending++;
        break;
    }
  }

  return {
    total: pending + ready + failed,
    pending,
    ready,
    failed,
  };
}
