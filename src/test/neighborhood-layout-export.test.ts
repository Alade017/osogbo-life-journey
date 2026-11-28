// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAYOUT_AREAS, layoutFileName, layoutJson } from "../../scripts/blender/export-layouts";

// The Blender generator reads scripts/blender/layouts/*.json. This fails if the game's TypeScript
// layout changed without re-running `npx tsx scripts/blender/export-layouts.ts`.
describe("neighbourhood layouts exported for Blender", () => {
  it.each(LAYOUT_AREAS.map((area) => [area.slug, area] as const))(
    "%s JSON matches the TypeScript layout",
    (_slug, area) => {
      const committed = readFileSync(join("scripts/blender/layouts", layoutFileName(area)), "utf8").replace(/\r\n/g, "\n");
      expect(committed).toBe(`${JSON.stringify(layoutJson(area), null, 2)}\n`);
    },
  );

  it.each(LAYOUT_AREAS.map((area) => [area.slug, area] as const))(
    "%s plots and roads keep the same footprints as the game's collision data",
    (_slug, area) => {
      const json = layoutJson(area);
      const compounds = (area.obstacles ?? []).filter((o) => o.kind === "compound");
      expect(json.lots).toHaveLength(compounds.length);
      expect(json.roads).toHaveLength((area.roads ?? []).length);
    },
  );
});
