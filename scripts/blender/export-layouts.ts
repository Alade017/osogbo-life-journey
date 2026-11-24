// Exports the hand-built neighbourhood layouts to JSON for the Blender generator.
//
// The TypeScript layouts in src/game are the single source of truth for roads, plots, shops,
// kiosks, gatehouses, trees and home/market/work/npc points: the same data the game uses for
// collision and for the server's movement checks. Visual-only decor (lamps, benches, palms,
// house styles) lives in neighborhood_environments.py and is merged in by the generator.
//
// Run:  npx tsx scripts/blender/export-layouts.ts          (writes scripts/blender/layouts/*.json)
// Check: src/test/neighborhood-layout-export.test.ts fails if the committed JSON is stale.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATIKU_AREA,
  OKE_FIA_AREA,
  type NeighborhoodArea,
  type NeighborhoodObstacle,
} from "../../src/game/neighborhood-model";

/** Street units per metre, and the street origin the Blender frame is centred on. */
const UNIT = 26.6667;
const ORIGIN = { x: 400, y: 300 };
/** Round to a 0.05 m grid so the export matches the generator's hand-written metre values. */
const snap = (v: number) => Math.round(v * 20) / 20;
const metres = (x: number, y: number) => ({
  x: snap((x - ORIGIN.x) / UNIT),
  z: snap((y - ORIGIN.y) / UNIT),
});
const size = (v: number) => snap(v / UNIT);

export const LAYOUT_AREAS: readonly NeighborhoodArea[] = [ATIKU_AREA, OKE_FIA_AREA];

/** Short id ("nw", "provisions") from an obstacle id like "atiku-compound-nw". */
function shortId(slug: string, id: string): string {
  return id.startsWith(`${slug}-`) ? id.slice(slug.length + 1).replace(/^compound-/, "") : id;
}

function footprint(o: NeighborhoodObstacle, slug: string) {
  const c = metres(o.x, o.y);
  return { id: shortId(slug, o.id), x: c.x, z: c.z, w: size(o.width), d: size(o.height) };
}

export function layoutJson(area: NeighborhoodArea) {
  const slug = area.slug;
  const obstacles = area.obstacles ?? [];
  const named = (kind: NeighborhoodObstacle["kind"], pick?: (o: NeighborhoodObstacle) => boolean) =>
    obstacles.filter((o) => o.kind === kind && (pick ? pick(o) : true));
  const gatehouse = obstacles.find((o) => o.kind === "landmark" && o.id.endsWith("-gatehouse"));

  const lots = named("compound").map((o) => {
    const f = footprint(o, slug);
    return { ...f, side: f.z < 0 ? 1 : -1 };
  });
  const single = (kind: NeighborhoodObstacle["kind"]) => {
    const o = named(kind)[0];
    return o ? { ...footprint(o, slug), label: o.label ?? "" } : null;
  };

  return {
    slug,
    name: area.name,
    roads: (area.roads ?? []).map((r) => ({
      id: r.id,
      axis: r.axis,
      offset_m:
        r.axis === "horizontal"
          ? snap((r.offset - ORIGIN.y) / UNIT)
          : snap((r.offset - ORIGIN.x) / UNIT),
      width_m: size(r.width),
      type: r.type,
    })),
    lots,
    shop: single("shop"),
    kiosk: single("kiosk"),
    gatehouse: gatehouse ? { ...footprint(gatehouse, slug), label: gatehouse.label ?? "" } : null,
    trees: named("tree").map((o) => {
      const c = metres(o.x, o.y);
      return [c.x, c.z];
    }),
    objects: (area.objects ?? []).map((o) => {
      const c = metres(o.x, o.y);
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
