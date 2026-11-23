import { describe, expect, it } from "vitest";
import {
  BANK_BRANCH_DESIGNS,
  BANK_WORLD,
  bankObstaclePolygons,
  buildBankWorld,
  type BankArea,
} from "@/game/bank-world-layout";
import { createBankNavigation } from "@/game/bank-lobby-navigation";
import type { BankSlug } from "@/lib/bank-branch-data";

for (const branch of Object.keys(BANK_BRANCH_DESIGNS) as BankSlug[])
  describe(branch, () => {
    for (const area of ["grounds", "hall", "upstairs"] as BankArea[])
      it(`${area}: every active service and transition is reachable without crossing a solid`, () => {
        const world = buildBankWorld(branch, area),
          nav = createBankNavigation(bankObstaclePolygons(world), {
            halfWidth: world.width / 2,
            halfDepth: world.depth / 2,
          });
        expect(nav.canWalk(world.spawn), `spawn ${world.spawn}`).toBe(true);
        for (const fixture of world.fixtures) {
          expect(nav.canWalk(fixture.point), `${fixture.id}: ${fixture.point}`).toBe(true);
          const path = nav.route(world.spawn, fixture.point);
          expect(path, `${fixture.id}: no route`).not.toBeNull();
        }
      });
  });
it("provides a 45x35 compound, five exterior ATMs and genuinely different branch architecture", () => {
  expect(BANK_WORLD.storeys).toBe(2);
  const cedar = buildBankWorld("cedar-bank", "grounds"),
    meridian = buildBankWorld("meridian-bank", "grounds");
  for (const layout of [cedar, meridian]) {
    expect([layout.width, layout.depth]).toEqual([45, 35]);
    expect(layout.fixtures.filter((f) => f.action === "atm")).toHaveLength(5);
    expect(
      new Set(layout.parts.map((part) => part.surface)).size + layout.signs.length + 4,
    ).toBeLessThan(120);
  }
  expect(cedar.parts).not.toEqual(meridian.parts);
  expect(
    buildBankWorld("cedar-bank", "hall").fixtures.filter((f) => f.id.startsWith("teller-")),
  ).toHaveLength(5);
  expect(
    buildBankWorld("meridian-bank", "hall").fixtures.filter((f) => f.id.startsWith("teller-")),
  ).toHaveLength(6);
  expect(buildBankWorld("cedar-bank", "upstairs").parts).not.toEqual(
    buildBankWorld("meridian-bank", "upstairs").parts,
  );
});
it("keeps the vault solid and all geometry finite with positive dimensions", () => {
  for (const branch of Object.keys(BANK_BRANCH_DESIGNS) as BankSlug[])
    for (const area of ["grounds", "hall", "upstairs"] as BankArea[]) {
      const layout = buildBankWorld(branch, area);
      for (const part of layout.parts) {
        expect(part.position.every(Number.isFinite)).toBe(true);
        expect(part.size.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
      }
      if (area === "upstairs") {
        const nav = createBankNavigation(bankObstaclePolygons(layout), {
          halfWidth: 13,
          halfDepth: 12,
        });
        expect(nav.canWalk([10, -8])).toBe(false);
        expect(nav.route(layout.spawn, [-7, -5])).not.toBeNull();
      }
    }
});

it("returns downstairs at the staircase instead of teleporting back to the security entrance", () => {
  for (const branch of Object.keys(BANK_BRANCH_DESIGNS) as BankSlug[]) {
    const world = buildBankWorld(branch, "hall", "upstairs");
    expect(world.spawn).toEqual([BANK_BRANCH_DESIGNS[branch].stairSide * 10, 5]);
    const nav = createBankNavigation(bankObstaclePolygons(world), { halfWidth: 13, halfDepth: 12 });
    expect(nav.canWalk(world.spawn)).toBe(true);
    expect(
      nav.route(world.spawn, world.fixtures.find((f) => f.id === "exit")!.point),
    ).not.toBeNull();
  }
});
