import type { VenueFixtureKind } from "@/lib/location-venue-designs";

const DENTAL_KIT = "/models/environments/dental-practice-kit";

/**
 * Real furniture for each venue fixture kind, from the supplied environment kits. A kind with no
 * matching model is not drawn, rather than drawn as a stand-in box.
 */
export const VENUE_FURNITURE: Partial<Record<VenueFixtureKind, { url: string; width: number }>> = {
  counter: { url: `${DENTAL_KIT}/cabinet-run-module.glb`, width: 1.8 },
  shelf: { url: `${DENTAL_KIT}/cabinet-run-module.glb`, width: 1.7 },
  seat: { url: `${DENTAL_KIT}/waiting-chairs-run.glb`, width: 1.25 },
  bench: { url: `${DENTAL_KIT}/waiting-chairs-run.glb`, width: 1.8 },
  table: { url: `${DENTAL_KIT}/low-table-with-magazines.glb`, width: 1.8 },
  screen: { url: `${DENTAL_KIT}/notice-board.glb`, width: 1.65 },
  display: { url: `${DENTAL_KIT}/notice-board.glb`, width: 1.35 },
};
