import town from "@/data/osogbo-town.json";
import {
  projectTownCell,
  townDiamondPoints,
  TOWN_TILE_COLOURS,
} from "@/components/map/town-map-geometry";

/** A grid cell of the town, as the city map uses them. */
export type PreviewCell = { x: number; z: number };

export type PreviewLandmark = {
  id: string;
  label: string;
  slug: string;
  cell: PreviewCell;
  districtId: string;
};

export type PreviewDistrict = { id: string; name: string; corners: [number, number][] };

/** Size of the zoomed view for a returning player, in map units. */
const FOCUS_WIDTH = 420;
const FOCUS_HEIGHT = 280;
const PADDING = 24;

const columns = town.meta.grid.columns;
const rows = town.meta.grid.rows;

/** Landmarks to show: every landmark, or only those whose location is active. */
export function previewLandmarks(activeSlugs: ReadonlySet<string> | null): PreviewLandmark[] {
  return town.landmarks
    .filter((place) => !activeSlugs || activeSlugs.has(place.locationSlug))
    .map((place) => ({
      id: place.id,
      label: place.label,
      slug: place.locationSlug,
      cell: { x: place.grid.x, z: place.grid.z },
      districtId: place.districtId,
    }));
}

/** The grid cell of a location's landmark, or null when the town has none for it. */
export function findLandmarkCell(slug: string | null | undefined): PreviewCell | null {
  if (!slug) return null;
  const place = town.landmarks.find((item) => item.locationSlug === slug);
  return place ? { x: place.grid.x, z: place.grid.z } : null;
}

/** Map-space centre of a grid cell. */
export function cellCentre(cell: PreviewCell): { x: number; y: number } {
  return projectTownCell(cell.x + 0.5, cell.z + 0.5);
}

function townBounds() {
  const corners = [
    projectTownCell(0, 0),
    projectTownCell(columns, 0),
    projectTownCell(0, rows),
    projectTownCell(columns, rows),
  ];
  const minX = Math.min(...corners.map((point) => point.x)) - PADDING;
  const maxX = Math.max(...corners.map((point) => point.x)) + PADDING;
  const minY = Math.min(...corners.map((point) => point.y)) - PADDING;
  const maxY = Math.max(...corners.map((point) => point.y)) + PADDING;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The SVG viewBox. With no focus it shows the whole town. With a focus cell it zooms
 * in on that cell, staying inside the town.
 */
export function previewViewBox(focus: PreviewCell | null): string {
  const bounds = townBounds();
  if (!focus) return `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;
  const centre = cellCentre(focus);
  const width = Math.min(FOCUS_WIDTH, bounds.width);
  const height = Math.min(FOCUS_HEIGHT, bounds.height);
  const x = Math.min(
    Math.max(centre.x - width / 2, bounds.minX),
    bounds.minX + bounds.width - width,
  );
  const y = Math.min(
    Math.max(centre.y - height / 2, bounds.minY),
    bounds.minY + bounds.height - height,
  );
  return `${x} ${y} ${width} ${height}`;
}

/** Diamond polygons for every tile, coloured as the city map colours them. */
export function previewTiles(): { key: string; points: string; fill: string }[] {
  const tiles: { key: string; points: string; fill: string }[] = [];
  town.grid.rows.forEach((row, z) => {
    [...row].forEach((cell, x) => {
      const colour = TOWN_TILE_COLOURS[cell] ?? TOWN_TILE_COLOURS["g"] ?? "";
      tiles.push({
        key: `${x}-${z}`,
        points: townDiamondPoints(x, z)
          .map(([px, py]) => `${px},${py}`)
          .join(" "),
        fill: colour,
      });
    });
  });
  return tiles;
}

/** Outline corners of each district, in map space. */
export function previewDistricts(): PreviewDistrict[] {
  return town.districts.map((district) => {
    const area = district.gridArea;
    return {
      id: district.id,
      name: district.name,
      corners: [
        projectTownCell(area.x, area.z),
        projectTownCell(area.x + area.width, area.z),
        projectTownCell(area.x + area.width, area.z + area.depth),
        projectTownCell(area.x, area.z + area.depth),
      ].map((point) => [point.x, point.y] as [number, number]),
    };
  });
}
