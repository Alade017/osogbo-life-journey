#!/usr/bin/env node
// Expand the Osogbo town map: 24x18 grid, 3 districts, 12 new places.
// Run from the repo root: npx tsx scripts/expand-town.ts
// Existing coordinates are kept. Rewrites osogbo-town.json and writes a migration.
import { readFileSync, writeFileSync } from "node:fs";

type Category =
    | "food"
    | "health"
    | "services"
    | "school"
    | "worship"
    | "market"
    | "sport"
    | "transport";

// [id, label, category, districtId, x, z, model]
type Place = [string, string, Category, string, number, number, string];

// [id, name, theme, traffic, description, x0, z0, x1, z1] (inclusive grid cells)
type District = [string, string, string, string, string, number, number, number, number];

interface TownFile {
    meta: { grid?: { columns: number; rows: number; cellSize: number } };
    grid: {
        rows: string[];
        buildings: { placeId: string; x: number; z: number; buildingType: string }[];
    };
    districts: unknown[];
    landmarks: unknown[];
}

const TOWN = "src/data/osogbo-town.json";
const MIGRATION = "supabase/migrations/20261022000000_expanded_town_places.sql";
const COLS = 24;
const ROWS = 18;
const CELL = 2;
const COMM = "/models/city/commercial/Models/GLB%20format/";
const SUB = "/models/city/suburban/Models/GLB%20format/";
const ROAD_ROWS = new Set < number > ([4, 8, 12, 16]);
const ROAD_COLS = new Set < number > ([6, 12, 18]);

const PLACES: Place[] = [
    ["riverside-food-court", "Riverside Food Court", "food", "river-quarter", 15, 1, COMM + "building-b.glb"],
    ["sunrise-health-post", "Sunrise Health Post", "health", "river-quarter", 21, 1, COMM + "building-c.glb"],
    ["harvest-tech-hub", "Harvest Tech Hub", "services", "river-quarter", 15, 6, COMM + "building-d.glb"],
    ["old-town-library", "Old Town Library", "school", "river-quarter", 21, 6, SUB + "building-type-b.glb"],
    ["fish-market", "Fish Market", "market", "south-quarter", 9, 11, COMM + "building-e.glb"],
    ["lagoon-hotel", "Lagoon Hotel", "services", "east-gate", 21, 11, COMM + "building-f.glb"],
    ["cinema-star", "Cinema Star", "sport", "east-gate", 15, 10, COMM + "building-g.glb"],
    ["fuel-and-go", "Fuel and Go Station", "transport", "east-gate", 15, 14, COMM + "building-h.glb"],
    ["youth-arts-centre", "Youth Arts Centre", "school", "east-gate", 21, 14, SUB + "building-type-d.glb"],
    ["post-office", "Post Office", "services", "south-quarter", 4, 14, SUB + "building-type-a.glb"],
];

const DISTRICTS: District[] = [
    ["river-quarter", "River quarter", "leisure", "medium", "A fictional riverside quarter with food, care and learning spots.", 14, 0, 23, 7],
    ["south-quarter", "South quarter", "residential", "medium", "A fictional southern quarter with services and worship spaces.", 0, 10, 13, 17],
    ["east-gate", "East gate", "transport", "high", "A fictional gateway with travel, entertainment and work spots.", 14, 10, 23, 17],
];

// locations.type values. Check these against your table's constraint before running the SQL.
const TYPE_FOR: Record<Category, string> = {
    food: "entertainment",
    sport: "entertainment",
    health: "hospital",
    services: "government",
    worship: "government",
    school: "government",
    market: "market",
    transport: "transport",
};
const DISTRICT_TYPE_FOR: Record<string, string> = {
    "river-quarter": "recreation",
    "south-quarter": "civic",
    "east-gate": "transport",
};

const sql = (s: string): string => "'" + s.replaceAll("'", "''") + "'";

const town = JSON.parse(readFileSync(TOWN, "utf8")) as TownFile;

// 1. Grid: pad to 24x18, then lay roads on the new rows and columns.
const rows: string[][] = town.grid.rows.map((r) =>
    [...r].concat(Array < string > (COLS - r.length).fill("g")),
);
while (rows.length < ROWS) rows.push(Array < string > (COLS).fill("g"));
for (const z of ROAD_ROWS) rows[z] = Array < string > (COLS).fill("r");
for (const x of ROAD_COLS) for (let z = 0; z < ROWS; z++) rows[z]![x] = "r";
town.grid.rows = rows.map((r) => r.join(""));
town.meta.grid = { columns: COLS, rows: ROWS, cellSize: CELL };

// 2. Districts (gridArea + a 6-point outline).
for (const [id, name, theme, traffic, description, x0, z0, x1, z1] of DISTRICTS) {
    const px0 = x0 * 40;
    const pz0 = z0 * 40;
    const px1 = (x1 + 1) * 40;
    const pz1 = (z1 + 1) * 40;
    const mx = (px0 + px1) / 2;
    town.districts.push({
        id,
        name,
        theme,
        traffic,
        description,
        shape: [[px0, pz0], [mx, pz0], [px1, pz0], [px1, pz1], [mx, pz1], [px0, pz1]],
        gridArea: { x: x0, z: z0, width: x1 - x0 + 1, depth: z1 - z0 + 1 },
    });
}

// 3. Places: landmark + grid building + a generic visit action.
for (const [pid, label, cat, districtId, x, z, model] of PLACES) {
    town.grid.buildings.push({ placeId: pid, x, z, buildingType: cat });
    town.landmarks.push({
        id: pid,
        label,
        category: cat,
        districtId,
        locationSlug: pid,
        // Approximate 2D label position, on the same scale as the existing entries.
        x: Math.round(-38 + 111.7 * x),
        y: Math.round(-5 + 75 * z),
        verify: false,
        grid: { x, z },
        buildingType: cat,
        model,
        actions: [
            {
                id: `${pid}-visit`,
                label: "Look around",
                description: `Spend time at ${label}.`,
                time_cost_minutes: 10,
                money_minor: { min: 0, max: 0 },
                mood_effect: 1,
                requirement: "Travel here first",
                open_hours: { start: 7, end: 21 },
                cooldown_game_minutes: 60,
                verify: false,
            },
        ],
    });
}

writeFileSync(TOWN, JSON.stringify(town, null, 2) + "\n", "utf8");

// 4. Migration: matching DB rows so travel and actions work (server-authoritative).
const lines: string[] = ["-- Expanded town places (generated by scripts/expand-town.ts)."];
lines.push("insert into public.map_districts (id,name,layout_x,layout_y) values");
lines.push(
    DISTRICTS.map(([id, name, , , , x0, z0]) => `  (${sql(id)},${sql(name)},${x0 * 40},${z0 * 40})`).join(",\n") +
    "\non conflict (id) do update set name=excluded.name, layout_x=excluded.layout_x, layout_y=excluded.layout_y;\n",
);
lines.push("insert into public.locations");
lines.push(
    "  (slug,name,tagline,description,district_type,map_x,map_y,color,planned_features,sort_order," +
    "type,latitude,longitude,icon,is_active,level_required,metadata,map_coordinate_mode," +
    "travel_fare,travel_minutes,canvas_x,canvas_y,map_category,neighbor_slugs,job_contract_slugs,entry_loops)",
);
lines.push("values");
lines.push(
    PLACES.map(([pid, label, cat, districtId, x, z], i) =>
        [
            `  (${sql(pid)},${sql(label)},${sql("Fictional public place in Osogbo")},`,
            `${sql("A fictional public venue for in-game activities. It is not a real business.")},`,
            `${sql(DISTRICT_TYPE_FOR[districtId]!)},${x * 5},${z * 5},'green',array['activities'],${70 + i},`,
            `${sql(TYPE_FOR[cat])},null,null,'landmark',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,`,
            `'virtual_game',0,1,${(x / COLS).toFixed(2)},${(z / ROWS).toFixed(2)},${sql(DISTRICT_TYPE_FOR[districtId]!)},`,
            `array[]::text[],array[]::text[],array['explore','social'])`,
        ].join(""),
    ).join(",\n"),
);
lines.push(
    "on conflict (slug) do update set name=excluded.name, is_active=true, " +
    "map_coordinate_mode='virtual_game', canvas_x=excluded.canvas_x, canvas_y=excluded.canvas_y;\n",
);
writeFileSync(MIGRATION, lines.join("\n"), "utf8");

console.log("Done. Add these to MAP_LANDMARK_LOCATION_SLUG in src/components/map/map-location-links.ts:");
for (const [pid] of PLACES) console.log(`  "${pid}": "${pid}",`);