import { describe, expect, it } from "vitest";
import {
  BANK_BRANCH_DESIGNS,
  BANK_WORLD,
  isBankWalkSurface,
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
it("provides a 50x40 compound, five exterior ATMs and genuinely different branch architecture", () => {
  expect(BANK_WORLD.storeys).toBe(2);
  const cedar = buildBankWorld("cedar-bank", "grounds"),
    meridian = buildBankWorld("meridian-bank", "grounds");
  for (const layout of [cedar, meridian]) {
    expect([layout.width, layout.depth]).toEqual([50, 40]);
    expect(layout.fixtures.filter((f) => f.action === "atm")).toHaveLength(5);
    expect(
      new Set(layout.parts.map((part) => part.surface + ":" + (part.shape ?? "box"))).size +
        layout.signs.length +
        4,
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
          halfWidth: layout.width / 2,
          halfDepth: layout.depth / 2,
        });
        expect(nav.canWalk([12, -9])).toBe(false);
        expect(nav.route(layout.spawn, [-8, -5])).not.toBeNull();
      }
    }
});

it("returns downstairs at the staircase instead of teleporting back to the security entrance", () => {
  for (const branch of Object.keys(BANK_BRANCH_DESIGNS) as BankSlug[]) {
    const world = buildBankWorld(branch, "hall", "upstairs");
    expect(world.spawn).toEqual([BANK_BRANCH_DESIGNS[branch].stairSide * BANK_WORLD.stairX, 5]);
    const nav = createBankNavigation(bankObstaclePolygons(world), {
      halfWidth: world.width / 2,
      halfDepth: world.depth / 2,
    });
    expect(nav.canWalk(world.spawn)).toBe(true);
    expect(
      nav.route(world.spawn, world.fixtures.find((f) => f.id === "exit")!.point),
    ).not.toBeNull();
  }
});

it("adds about thirty percent usable floor area while keeping human-scale furniture", () => {
  for (const branch of Object.keys(BANK_BRANCH_DESIGNS) as BankSlug[]) {
    const layout = buildBankWorld(branch, "hall");
    expect((layout.width * layout.depth) / (26 * 24)).toBeCloseTo(1.298, 2);
    expect(
      layout.parts.find((part) => part.fixture?.startsWith("seat-") && part.surface === "dark")
        ?.size[0],
    ).toBe(0.62);
    const shell = buildBankWorld(branch, "grounds").parts.find(
      (part) => part.surface === "wall" && part.blocking && part.size[1] === 8.5,
    )!;
    expect([shell.size[0], shell.size[2]]).toEqual([layout.width, layout.depth]);
  }
});
it("keeps gate, ATM approach lanes and the enlarged building separate", () => {
  for (const branch of Object.keys(BANK_BRANCH_DESIGNS) as BankSlug[]) {
    const world = buildBankWorld(branch, "grounds"),
      design = BANK_BRANCH_DESIGNS[branch];
    const nav = createBankNavigation(bankObstaclePolygons(world), {
      halfWidth: world.width / 2,
      halfDepth: world.depth / 2,
    });
    expect(nav.route(world.spawn, [design.entranceX, BANK_WORLD.lotDepth / 2 - 1])).not.toBeNull();
    expect(world.parts.some((part) => part.pitch !== undefined && part.position[1] > 8)).toBe(true);
    expect(world.parts.some((part) => part.shape === "sphere")).toBe(true);
    for (const part of world.parts.filter((part) => part.blocking)) {
      expect(Math.abs(part.position[0]) + part.size[0] / 2).toBeLessThanOrEqual(
        world.width / 2 + 0.01,
      );
      expect(Math.abs(part.position[2]) + part.size[2] / 2).toBeLessThanOrEqual(
        world.depth / 2 + 0.01,
      );
    }
  }
});

it("keeps courtyard walkways and parking markings clickable without treating walls or roofs as floor", () => {
  const layout = buildBankWorld("cedar-bank", "grounds");
  const path = layout.parts.find((part) => part.surface === "wall" && part.size[0] === 1.25)!;
  const paint = layout.parts.find((part) => part.surface === "marking")!;
  const building = layout.parts.find((part) => part.surface === "wall" && part.size[1] === 8.5)!;
  const roof = layout.parts.find((part) => part.position[1] > 8)!;
  expect(isBankWalkSurface(path)).toBe(true);
  expect(path.position[1] + path.size[1] / 2).toBeLessThanOrEqual(0.05);
  expect(isBankWalkSurface(paint)).toBe(true);
  expect(isBankWalkSurface(building)).toBe(false);
  expect(isBankWalkSurface(roof)).toBe(false);
});
