import { describe, expect, it } from "vitest";
import { VENUE_FURNITURE } from "@/lib/venue-furniture-assets";

import {
  getFurnitureKey,
  summarizeFurnitureReadiness,
} from "@/lib/venue-furniture-readiness";

import type {
  VenueFixture,
  VenueFixtureKind,
} from "@/lib/location-venue-designs";

function fixture(
  id: string,
  kind: VenueFixtureKind,
): VenueFixture {
  return {
    id,
    kind,
    label: id,
    detail: id,
    position: [0, 0],
  };
}

describe("venue furniture readiness", () => {
  const table = fixture("table-a", "table");
  const seat = fixture("seat-a", "seat");

  it("counts supported fixtures as pending initially", () => {
    expect(
      summarizeFurnitureReadiness([table, seat], {}),
    ).toEqual({
      total: 2,
      pending: 2,
      ready: 0,
      failed: 0,
    });
  });

  it("counts mounted furniture as ready", () => {
    expect(
      summarizeFurnitureReadiness([table, seat], {
        [getFurnitureKey(table)]: "ready",
      }),
    ).toEqual({
      total: 2,
      pending: 1,
      ready: 1,
      failed: 0,
    });
  });

  it("counts failed furniture independently", () => {
    expect(
      summarizeFurnitureReadiness([table, seat], {
        [getFurnitureKey(table)]: "failed",
        [getFurnitureKey(seat)]: "ready",
      }),
    ).toEqual({
      total: 2,
      pending: 0,
      ready: 1,
      failed: 1,
    });
  });

  it("tracks shared asset instances independently", () => {
    const anotherTable = fixture("table-b", "table");

    expect(
      summarizeFurnitureReadiness(
        [table, anotherTable],
        {
          [getFurnitureKey(table)]: "ready",
        },
      ),
    ).toEqual({
      total: 2,
      pending: 1,
      ready: 1,
      failed: 0,
    });
  });

  it("excludes removed fixtures from the summary", () => {
    expect(
      summarizeFurnitureReadiness([seat], {
        [getFurnitureKey(table)]: "ready",
      }),
    ).toEqual({
      total: 1,
      pending: 1,
      ready: 0,
      failed: 0,
    });
  });

  it("does not reuse results after fixture kind changes", () => {
    const changed = fixture(table.id, "seat");

    expect(
      summarizeFurnitureReadiness([changed], {
        [getFurnitureKey(table)]: "ready",
      }),
    ).toEqual({
      total: 1,
      pending: 1,
      ready: 0,
      failed: 0,
    });
  });

  it("handles an empty fixture collection", () => {
    expect(
      summarizeFurnitureReadiness([], {}),
    ).toEqual({
      total: 0,
      pending: 0,
      ready: 0,
      failed: 0,
    });
  });

  it("includes the configured asset URL in fixture identity", () => {
    expect(JSON.parse(getFurnitureKey(table))).toEqual([
      table.id,
      table.kind,
      VENUE_FURNITURE.table?.url,
    ]);
  });

  it("excludes unsupported fixtures from readiness tracking", () => {
    const planter = fixture("plant-1", "planter");

    expect(
      summarizeFurnitureReadiness([planter], {}),
    ).toEqual({
      total: 0,
      pending: 0,
      ready: 0,
      failed: 0,
    });
  });
});
