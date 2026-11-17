import { expect, it } from "vitest";
import { BANK_INTERIORS } from "@/game/bank-interiors";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
it("assigns structurally different interiors to the two existing banks", () => {
  const cedar = getLocationVenueDesign("cedar-bank", "Cedar Bank");
  const meridian = getLocationVenueDesign("meridian-bank", "Meridian Bank");
  expect(cedar.bankInterior).toBe("teller-hall");
  expect(meridian.bankInterior).toBe("digital-lounge");
  expect(BANK_INTERIORS["teller-hall"].tellerWindows).toHaveLength(3);
  expect(BANK_INTERIORS["digital-lounge"].kioskOffsets).toHaveLength(2);
  expect(cedar.fixtures.map(f => f.id)).toEqual(["cedar-teller", "cedar-queue", "cedar-info"]);
  expect(meridian.fixtures.map(f => f.id)).toEqual(["meridian-service", "meridian-kiosk", "meridian-seating"]);
});
it("keeps both banks' fixtures within the authored room and leaves other venues unchanged", () => {
  for (const slug of ["cedar-bank", "meridian-bank"]) {
    const venue = getLocationVenueDesign(slug, slug);
    const layout = BANK_INTERIORS[venue.bankInterior!];
    for (const f of venue.fixtures) {
      expect(Math.abs(f.position[0])).toBeLessThan(layout.width / 2);
      expect(Math.abs(f.position[1])).toBeLessThan(layout.depth / 2);
    }
  }
  expect(getLocationVenueDesign("town-market", "Market").bankInterior).toBeUndefined();
});
