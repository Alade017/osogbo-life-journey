// Exports the hand-built neighbourhood layouts to JSON for the Blender generator.
//
// The TypeScript layouts in src/game are the single source of truth for roads, plots, shops,
// kiosks, gatehouses, trees and home/market/work/npc points: the same data the game uses for
// collision and for the server's movement checks. Visual-only decor (lamps, benches, palms,
// house styles) lives in neighborhood_environments.py and is merged in by the generator.
//
// Each area's Blender frame is centred on its environment, so the GLB sits exactly on the
// footprint the game uses. Run:  npx tsx scripts/blender/export-layouts.ts
// src/test/neighborhood-layout-export.test.ts fails if the committed JSON is stale.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATIKU_AREA,
  CITY_CENTRE_AREA,
  OKE_FIA_AREA,
  type NeighborhoodArea,
  type NeighborhoodObstacle,
} from "../../src/game/neighborhood-model";

/** Street units per metre (WORLD_SCALE.neighborhoodUnit). */
const UNIT = 26.6667;
/** Round to a 0.05 m grid so the export matches the generator's metre values. */
const snap = (v: number) => Math.round(v * 20) / 20;
const size = (v: number) => snap(v / UNIT);

type Origin = { x: number; y: number };

function originFor(area: NeighborhoodArea): Origin {
  if (!area.environment) throw new Error(`${area.slug} needs an environment to export`);
  return { x: area.environment.x, y: area.environment.y };
}

function metres(x: number, y: number, origin: Origin) {
  return { x: snap((x - origin.x) / UNIT), z: snap((y - origin.y) / UNIT) };
}

export const LAYOUT_AREAS: readonly NeighborhoodArea[] = [
  ATIKU_AREA,
  OKE_FIA_AREA,
  CITY_CENTRE_AREA,
];

/** Short id ("nw", "provisions") from an obstacle id like "atiku-compound-nw". */
function shortId(slug: string, id: string): string {
  return id.startsWith(`${slug}-`) ? id.slice(slug.length + 1).replace(/^compound-/, "") : id;
}

function footprint(o: NeighborhoodObstacle, slug: string, origin: Origin) {
  const c = metres(o.x, o.y, origin);
  return { id: shortId(slug, o.id), x: c.x, z: c.z, w: size(o.width), d: size(o.height) };
}

export function layoutJson(area: NeighborhoodArea) {
  const slug = area.slug;
  const origin = originFor(area);
  const env = area.environment!;
  const obstacles = area.obstacles ?? [];
  const named = (kind: NeighborhoodObstacle["kind"]) => obstacles.filter((o) => o.kind === kind);
  const avenue = (area.roads ?? []).find((r) => r.axis === "horizontal" && r.type === "arterial");
  const avenueZ = avenue ? metres(0, avenue.offset, origin).z : 0;
  const gatehouse = obstacles.find((o) => o.kind === "landmark" && o.id.endsWith("-gatehouse"));
  const single = (kind: NeighborhoodObstacle["kind"]) => {
    const o = named(kind)[0];
    return o ? { ...footprint(o, slug, origin), label: o.label ?? "" } : null;
  };

  return {
    slug,
    name: area.name,
    frame: { width_m: size(env.width), depth_m: size(env.height) },
    roads: (area.roads ?? []).map((r) => ({
      id: r.id,
      axis: r.axis,
      offset_m: snap((r.axis === "horizontal" ? r.offset - origin.y : r.offset - origin.x) / UNIT),
      width_m: size(r.width),
      type: r.type,
    })),
    lots: named("compound").map((o) => {
      const f = footprint(o, slug, origin);
      // Plots face the avenue (the first arterial): side +1 is the plot north of it, -1 south.
      return { ...f, side: f.z < avenueZ ? 1 : -1 };
    }),
    shop: single("shop"),
    kiosk: single("kiosk"),
    gatehouse: gatehouse
      ? { ...footprint(gatehouse, slug, origin), label: gatehouse.label ?? "" }
      : null,
    /** Every named place on the street (shops, kiosks, landmarks), with its kind and label. */
    places: obstacles
      .filter((o) => o.kind === "shop" || o.kind === "kiosk" || o.kind === "landmark")
      .map((o) => ({ ...footprint(o, slug, origin), kind: o.kind, label: o.label ?? "" })),
    trees: named("tree").map((o) => {
      const c = metres(o.x, o.y, origin);
      return [c.x, c.z];
    }),
    objects: (area.objects ?? []).map((o) => {
      const c = metres(o.x, o.y, origin);
      return { id: o.id, name: o.name, kind: o.kind, x: c.x, z: c.z };
    }),
  };
}

export function layoutFileName(area: NeighborhoodArea): string {
  return `${area.slug}.json`;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, "layouts");
  mkdirSync(outDir, { recursive: true });
  for (const area of LAYOUT_AREAS) {
    writeFileSync(
      join(outDir, layoutFileName(area)),
      `${JSON.stringify(layoutJson(area), null, 2)}\n`,
    );
    console.log("wrote", join("scripts/blender/layouts", layoutFileName(area)));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
