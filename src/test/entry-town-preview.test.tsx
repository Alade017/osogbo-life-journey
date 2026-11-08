import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntryTownPreview } from "@/components/game/EntryTownPreview";
import {
  cellCentre,
  findLandmarkCell,
  previewDistricts,
  previewLandmarks,
  previewTiles,
  previewViewBox,
} from "@/components/game/entry-town-preview";
import town from "@/data/osogbo-town.json";
import { TOWN_TILE_COLOURS } from "@/components/map/town-map-geometry";

function parseViewBox(value: string) {
  const [x, y, width, height] = value.split(" ").map(Number);
  return { x: x ?? NaN, y: y ?? NaN, width: width ?? NaN, height: height ?? NaN };
}

describe("town preview data", () => {
  it("draws every grid tile in the city map colours", () => {
    const tiles = previewTiles();
    expect(tiles).toHaveLength(town.meta.grid.columns * town.meta.grid.rows);
    const palette = Object.values(TOWN_TILE_COLOURS);
    expect(tiles.every((tile) => palette.includes(tile.fill))).toBe(true);
  });

  it("draws every district with a four-corner outline", () => {
    const districts = previewDistricts();
    expect(districts).toHaveLength(town.districts.length);
    expect(districts.every((district) => district.corners.length === 4)).toBe(true);
  });

  it("shows every landmark for a null filter, and only active ones otherwise", () => {
    expect(previewLandmarks(null)).toHaveLength(town.landmarks.length);
    const onlyMarket = previewLandmarks(new Set(["town-market"]));
    expect(onlyMarket.map((place) => place.slug)).toEqual(["town-market"]);
    expect(previewLandmarks(new Set())).toEqual([]);
  });

  it("finds a landmark's grid cell from its location slug", () => {
    expect(findLandmarkCell("town-market")).toEqual({ x: 2, z: 2 });
    expect(findLandmarkCell("no-such-place")).toBeNull();
    expect(findLandmarkCell(null)).toBeNull();
  });
});

describe("town preview view", () => {
  it("shows the whole town when there is no focus", () => {
    const view = parseViewBox(previewViewBox(null));
    const centre = cellCentre({ x: 2, z: 2 });
    expect(view.x).toBeLessThan(centre.x);
    expect(view.x + view.width).toBeGreaterThan(centre.x);
    expect(view.width).toBeGreaterThan(420);
  });

  it("zooms in on a returning player's last stop, and keeps it in view", () => {
    const focus = { x: 2, z: 2 };
    const view = parseViewBox(previewViewBox(focus));
    const centre = cellCentre(focus);
    expect(view.width).toBe(420);
    expect(view.height).toBe(280);
    expect(centre.x).toBeGreaterThanOrEqual(view.x);
    expect(centre.x).toBeLessThanOrEqual(view.x + view.width);
    expect(centre.y).toBeGreaterThanOrEqual(view.y);
    expect(centre.y).toBeLessThanOrEqual(view.y + view.height);
  });
});

describe("EntryTownPreview", () => {
  it("draws only the places that are open", () => {
    const label = town.landmarks.find((place) => place.locationSlug === "town-market")?.label;
    const { container } = render(<EntryTownPreview activeSlugs={new Set(["town-market"])} />);
    const labels = Array.from(container.querySelectorAll("text.entry-world-label")).map(
      (node) => node.textContent,
    );
    expect(labels).toEqual([label]);
    expect(container.querySelector("svg")).toHaveAttribute("role", "img");
  });

  it("names the last stop in its caption", () => {
    const { container } = render(
      <EntryTownPreview focus={{ x: 2, z: 2 }} focusLabel="Town Market" activeSlugs={null} />,
    );
    expect(container.querySelector("figcaption")?.textContent).toBe("Your last stop: Town Market.");
  });
});

describe("landing page rules", () => {
  const page = readFileSync(resolve(process.cwd(), "src/routes/index.tsx"), "utf8");
  const copy = JSON.parse(
    readFileSync(resolve(process.cwd(), "src/data/landing-copy.json"), "utf8"),
  ) as { howItWorks: unknown[] };

  it("uses no photo from the database or the page itself", () => {
    expect(page).not.toContain("image_url");
    expect(page).not.toContain("entry-scene-photo");
  });

  it("keeps the three how-it-works steps in the copy file", () => {
    expect(copy.howItWorks).toHaveLength(3);
  });
});
