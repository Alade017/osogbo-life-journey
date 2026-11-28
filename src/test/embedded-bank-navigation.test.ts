import { expect, it } from "vitest";
import { createEmbeddedBankNavigation } from "@/game/embedded-bank-navigation";
import type { VenueFixture } from "@/lib/location-venue-designs";

const fixture = (id: string, kind: VenueFixture["kind"]): VenueFixture => ({
  id,
  kind,
  label: id,
  detail: id,
  position: [0, 0],
});

it.each(["teller-hall", "digital-lounge"] as const)(
  "keeps the %s spawn walkable and routes to rendered service and seating fixtures",
  (variant) => {
    const bank = createEmbeddedBankNavigation(variant);
    const start: [number, number] = [bank.spawn[0], bank.spawn[2]];
    expect(bank.navigation.canWalk(start)).toBe(true);

    const tellerPath = bank.approach(start, fixture("bank-counter", "counter"));
    const seatPath = bank.approach(start, fixture("bank-seating", "seat"));
    expect(tellerPath).not.toBeNull();
    expect(seatPath).not.toBeNull();

    for (const path of [tellerPath!, seatPath!]) {
      expect(path.length).toBeGreaterThan(1);
      for (const point of path) expect(bank.navigation.canWalk(point)).toBe(true);
    }
  },
);

it("rejects a route that starts outside the bank lobby bounds", () => {
  const bank = createEmbeddedBankNavigation("teller-hall");
  expect(bank.navigation.route([99, 99], [0, 0])).toBeNull();
});
