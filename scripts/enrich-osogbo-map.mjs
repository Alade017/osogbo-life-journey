import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/data/osogbo-map.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const districtCells = {
  "oja-oba": [0, 0],
  ataoja: [3, 0],
  "aleku-wodo": [6, 0],
  olaiya: [9, 0],
  "oke-fia": [0, 5],
  "oke-baale": [3, 5],
  "isale-aro": [6, 5],
  "ogo-oluwa": [9, 5],
};
const placeSeed = [
  [
    "oja-oba",
    "oja-oba-market",
    "Oja Oba Market",
    "market",
    105,
    160,
    "Wikipedia: Oja Oba Market is beside Osogbo Grand Mosque",
    false,
  ],
  [
    "ataoja",
    "ataoja-police-station",
    "Ataoja Police Station",
    "services",
    375,
    150,
    "User supplied public landmark",
    true,
  ],
  [
    "ataoja",
    "ataoja-palace",
    "Ataoja Palace",
    "services",
    475,
    170,
    "TripTap: palace on Ilesha Road",
    true,
  ],
  [
    "oke-baale",
    "oke-baale-local-government-hq",
    "Oke-Baale Local Government Headquarters",
    "services",
    375,
    540,
    "User supplied public landmark",
    true,
  ],
  [
    "oke-baale",
    "osogbo-school-of-art",
    "Osogbo School of Art",
    "school",
    475,
    560,
    "Wikipedia: Osogbo School of Art",
    true,
  ],
  [
    "ogo-oluwa",
    "osogbo-township-stadium",
    "Osogbo Township Stadium",
    "sport",
    1025,
    545,
    "Wikipedia: Osogbo Township Stadium",
    false,
  ],
  [
    "aleku-wodo",
    "aleku-wodo-road-network",
    "Alekuwodo Road Network",
    "junction",
    775,
    175,
    "The Sun, 2020: Alekuwodo road network",
    true,
  ],
  [
    "oke-fia",
    "oke-fia-flyover",
    "Oke-Fia Flyover",
    "junction",
    105,
    545,
    "VON, Aug 2026: flyover reference; exact Osogbo placement unconfirmed",
    true,
  ],
];
const actionsByCategory = {
  market: ["Browse stalls", "Buy food", "Sell goods", "Haggle"],
  services: [
    "Ask for directions",
    "Request assistance",
    "Make an in-game report",
    "Speak with staff",
  ],
  school: ["View exhibition", "Join a workshop", "Practice art", "Meet artists"],
  sport: ["Play a game", "Watch a match", "Train", "Meet friends"],
  junction: ["Check routes", "Commute", "Walk the district", "Ask for directions"],
};
const gameMinutes = [10, 20, 30, 15];
for (const district of data.districts) {
  const [col, row] = districtCells[district.id];
  district.height = district.id === "oke-fia" ? 2 : 0;
  district.isoCells = Array.from({ length: 6 }, (_, index) => ({
    col: col + (index % 3),
    row: row + Math.floor(index / 3),
  }));
  district.source = [
    "Oja Oba",
    "Ataoja",
    "Alekuwodo",
    "Olaiya",
    "Oke-Fia",
    "Oke-Baale",
    "Isale-Aro",
    "Ogo-Oluwa",
  ].includes(district.name)
    ? "Public district name; hand-placed gameplay layout"
    : "Proposed district; resident review needed";
  district.verify = district.verify === true || ["isale-aro", "ogo-oluwa"].includes(district.id);
  district.landmarks = [];
}
for (const [districtId, id, label, category, x, y, source, verify] of placeSeed) {
  const district = data.districts.find((entry) => entry.id === districtId);
  const [col, row] = districtCells[districtId];
  const b = district.shape;
  const minX = Math.min(...b.map(([px]) => px)),
    maxX = Math.max(...b.map(([px]) => px));
  const minY = Math.min(...b.map(([, py]) => py)),
    maxY = Math.max(...b.map(([, py]) => py));
  const isoCell = {
    col: +(col + 0.3 + ((x - minX) / (maxX - minX)) * 2.1).toFixed(2),
    row: +(row + 0.25 + ((y - minY) / (maxY - minY)) * 1.45).toFixed(2),
  };
  const actions = (actionsByCategory[category] ?? actionsByCategory.services).map(
    (action, index) => ({
      id: `${id}-${action
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`,
      label: action,
      description: `Spend time at ${label.toLowerCase()} in a fictional game activity.`,
      time_cost_minutes: gameMinutes[index],
      money_minor:
        action === "Buy food"
          ? { min: 250, max: 450 }
          : action === "Sell goods"
            ? { min: -600, max: -150 }
            : { min: 0, max: 0 },
      mood_effect: index === 2 ? 2 : index === 3 ? 0 : 1,
      needs_effects: action === "Buy food" ? { hunger_satisfaction: 25 } : {},
      requirement: action === "Sell goods" ? "Needs a market job" : "Travel here first",
      open_hours: category === "market" ? { start: 8, end: 18 } : { start: 0, end: 24 },
      cooldown_game_minutes: 30,
      verify: true,
    }),
  );
  district.landmarks.push({ id, label, category, x, y, isoCell, source, verify, actions });
}
data.excluded = [{ name: "Osun-Osogbo Sacred Grove", reason: "sacred site, not playable" }];
data.meta.source = "Hand-placed gameplay map; no geographic coordinates";
writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
