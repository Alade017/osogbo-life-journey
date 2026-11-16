#!/usr/bin/env node
// Adds a district to the town map and grows the map when needed.
// Usage: node --experimental-strip-types scripts/add-town-district.ts spec.json
// spec.json: { "id", "name", "theme", "traffic", "description", "width", "depth" }
// Writes src/data/osogbo-town.json only if the result passes the map validator.
import { readFileSync, writeFileSync } from "node:fs";
import {
  addDistrictToTown,
  type NewDistrictSpec,
  type TownGridData,
} from "../src/game/town-growth.ts";
import { validateTownMapData } from "../src/game/town-map-validation.ts";

const TOWN = "src/data/osogbo-town.json";
const specPath = process.argv[2];
if (!specPath) {
  console.error("Usage: node --experimental-strip-types scripts/add-town-district.ts spec.json");
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, "utf8")) as NewDistrictSpec;
const town = JSON.parse(readFileSync(TOWN, "utf8")) as TownGridData;
const grown = addDistrictToTown(town, spec);
const errors = validateTownMapData(grown as never);
if (errors.length > 0) {
  console.error("Not written. The map failed validation:");
  for (const error of errors) console.error(" -", error);
  process.exit(1);
}
writeFileSync(TOWN, JSON.stringify(grown, null, 2) + "\n");
const area = grown.districts.at(-1)!.gridArea;
console.log(
  `Added "${spec.id}" at grid ${area.x},${area.z} (${area.width}x${area.depth}). Map is now ${grown.meta.grid.columns}x${grown.grid.rows.length}.`,
);
