import type { NeighborhoodObstacle, WorldPoint } from "./neighborhood-model.ts";

export type NeighborhoodZoneTag =
  "FILLING_STATION" | "BANK" | "ADIRE_MARKET" | "COMMERCIAL_SHOPS" | "PERIMETER";

export type ZoneGroundSurface =
  "stained-concrete" | "interlocking-paving" | "laterite" | "asphalt-shoulder" | "compound-yard";

export interface NeighborhoodZoneRect {
  id: string;
  tag: NeighborhoodZoneTag;
  x: number;
  y: number;
  width: number;
  height: number;
  groundSurface: ZoneGroundSurface;
}

export interface DrivewayCutout {
  id: string;
  roadId: string;
  side: -1 | 1;
  start: number;
  end: number;
}

export interface FillingStationSpec {
  zoneId: string;
  forecourt: { x: number; y: number; width: number; height: number };
  apron: { x: number; y: number; width: number; height: number };
  canopy: { x: number; y: number; width: number; height: number };
  pumpIslands: readonly { id: string; x: number; y: number; width: number; height: number }[];
  miniMart: {
    x: number;
    y: number;
    width: number;
    height: number;
    doorCenterY: number;
    doorWidth: number;
    interiorBounds: { left: number; right: number; top: number; bottom: number };
  };
  waterTank: { x: number; y: number; width: number; height: number };
  vulcanizer: { x: number; y: number; radius: number };
  jerrycanStacks: readonly WorldPoint[];
  bollards: readonly WorldPoint[];
}

export interface CommercialBankSpec {
  zoneId: string;
  courtyard: { x: number; y: number; width: number; height: number };
  building: { x: number; y: number; width: number; height: number };
  lobbyDoorCenterY: number;
  lobbyDoorWidth: number;
  lobbyBounds: { left: number; right: number; top: number; bottom: number };
  atmAlcove: { x: number; y: number; width: number; height: number };
  stanchions: readonly WorldPoint[];
  pottedPalms: readonly WorldPoint[];
  parkingLot: { x: number; y: number; width: number; height: number };
  securityPost: { x: number; y: number; width: number; height: number };
  parkedSedans: readonly { x: number; y: number; rotation: number; color: string }[];
  gateCenterY: number;
  gateWidth: number;
}

export interface AdireMarketSpec {
  zoneId: string;
  yards: readonly { x: number; y: number; width: number; height: number }[];
  dyeShed: { x: number; y: number; width: number; height: number };
  dyeVats: readonly WorldPoint[];
  dryingRacks: readonly { id: string; x: number; y: number; rotation: number; width: number }[];
  marketTables: readonly { id: string; x: number; y: number; umbrellaColor: string }[];
  bukaStall: { id: string; x: number; y: number; width: number; height: number };
  crates: readonly WorldPoint[];
}

export interface CommercialShopsSpec {
  zoneId: string;
  shoulderBay: { x: number; y: number; width: number; height: number };
  shops: readonly {
    id: string;
    kind: "barber" | "pos" | "accessory";
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    accent: string;
    walkIn?: boolean;
    doorWidth?: number;
    interiorBounds?: { left: number; right: number; top: number; bottom: number };
  }[];
  kekeVehicles: readonly { x: number; y: number; rotation: number; color: string }[];
  koropeBuses: readonly { x: number; y: number; rotation: number }[];
}

export interface PerimeterBuildingInstance {
  x: number;
  y: number;
  width: number;
  height: number;
  stories: 1 | 2;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
  wallColor: string;
  roofVariant: "laterite" | "silver";
}

export interface PerimeterCompoundWall {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PerimeterTreeInstance {
  x: number;
  y: number;
  species: "oil-palm" | "neem";
  scale: number;
  rotation: number;
}

export interface PerimeterUtilityPole {
  x: number;
  y: number;
  rotation: number;
}

export interface PerimeterWireSpan {
  start: WorldPoint;
  end: WorldPoint;
}

export interface PerimeterSpec {
  buildings: readonly PerimeterBuildingInstance[];
  walls: readonly PerimeterCompoundWall[];
  trees: readonly PerimeterTreeInstance[];
  poles: readonly PerimeterUtilityPole[];
  wireSpans: readonly PerimeterWireSpan[];
}

export interface NeighborhoodZoneLayout {
  zones: readonly NeighborhoodZoneRect[];
  serviceAlley: { x: number; y: number; width: number; height: number };
  drivewayCutouts: readonly DrivewayCutout[];
  fillingStation: FillingStationSpec;
  bank: CommercialBankSpec;
  adireMarket: AdireMarketSpec;
  commercialShops: CommercialShopsSpec;
  perimeter: PerimeterSpec;
}

export function isPointInZoneRect(point: WorldPoint, rect: NeighborhoodZoneRect): boolean {
  return (
    point.x >= rect.x - rect.width / 2 &&
    point.x <= rect.x + rect.width / 2 &&
    point.y >= rect.y - rect.height / 2 &&
    point.y <= rect.y + rect.height / 2
  );
}

export function zoneTagAtPoint(
  zones: readonly NeighborhoodZoneRect[],
  point: WorldPoint,
): NeighborhoodZoneTag {
  const match = zones.find((zone) => isPointInZoneRect(point, zone));
  return match?.tag ?? "PERIMETER";
}

const RESIDENTIAL_WALL_PALETTE = ["#e8dcc6", "#dfd1b4", "#ecd9c2", "#d8c7ab", "#f0e3cf"] as const;

function buildPerimeterLayout(): {
  perimeter: PerimeterSpec;
  obstacles: NeighborhoodObstacle[];
} {
  const buildings: PerimeterBuildingInstance[] = [];
  const walls: PerimeterCompoundWall[] = [];
  const trees: PerimeterTreeInstance[] = [];
  const obstacles: NeighborhoodObstacle[] = [];

  type ClusterSeed = {
    id: string;
    cx: number;
    cy: number;
    width: number;
    height: number;
    houses: readonly { dx: number; dy: number; stories: 1 | 2; rot: 0 | 1 | 2 | 3 }[];
    treeOffsets: readonly { dx: number; dy: number; species: "oil-palm" | "neem" }[];
  };

  // Perimeter clusters sit around the outer edges of the 3840x3200 neighbourhood
  // bounds, framing the central commercial avenues and outer market/shop strips.
  const clusters: ClusterSeed[] = [
    {
      id: "nw-ridge",
      cx: -610,
      cy: -380,
      width: 280,
      height: 220,
      houses: [
        { dx: -68, dy: -46, stories: 2, rot: 0 },
        { dx: 64, dy: 44, stories: 1, rot: 1 },
      ],
      treeOffsets: [
        { dx: -115, dy: 72, species: "oil-palm" },
        { dx: 110, dy: -75, species: "neem" },
      ],
    },
    {
      id: "n-west-mid",
      cx: -140,
      cy: -385,
      width: 340,
      height: 220,
      houses: [
        { dx: -85, dy: -32, stories: 1, rot: 2 },
        { dx: 82, dy: 38, stories: 2, rot: 0 },
      ],
      treeOffsets: [
        { dx: 0, dy: -78, species: "oil-palm" },
        { dx: -140, dy: 76, species: "neem" },
      ],
    },
    {
      id: "n-central",
      cx: 880,
      cy: -385,
      width: 460,
      height: 220,
      houses: [
        { dx: -135, dy: -34, stories: 2, rot: 0 },
        { dx: 15, dy: 42, stories: 1, rot: 3 },
        { dx: 150, dy: -30, stories: 2, rot: 2 },
      ],
      treeOffsets: [
        { dx: -200, dy: 74, species: "neem" },
        { dx: 85, dy: -82, species: "oil-palm" },
        { dx: 205, dy: 70, species: "oil-palm" },
      ],
    },
    {
      id: "n-east",
      cx: 1580,
      cy: -385,
      width: 410,
      height: 220,
      houses: [
        { dx: -105, dy: 34, stories: 1, rot: 1 },
        { dx: 95, dy: -36, stories: 2, rot: 0 },
      ],
      treeOffsets: [
        { dx: -175, dy: -75, species: "oil-palm" },
        { dx: 175, dy: 78, species: "neem" },
      ],
    },
    {
      id: "ne-corner",
      cx: 2220,
      cy: -385,
      width: 420,
      height: 220,
      houses: [
        { dx: -105, dy: -34, stories: 2, rot: 3 },
        { dx: 105, dy: 38, stories: 1, rot: 2 },
      ],
      treeOffsets: [
        { dx: 0, dy: -76, species: "neem" },
        { dx: 185, dy: -76, species: "oil-palm" },
      ],
    },
    {
      id: "ne-far",
      cx: 2800,
      cy: -385,
      width: 340,
      height: 220,
      houses: [
        { dx: -70, dy: -30, stories: 1, rot: 0 },
        { dx: 76, dy: 40, stories: 2, rot: 1 },
      ],
      treeOffsets: [{ dx: -140, dy: 80, species: "oil-palm" }],
    },
    {
      id: "sw-compound",
      cx: -610,
      cy: 1020,
      width: 280,
      height: 240,
      houses: [
        { dx: -56, dy: -42, stories: 2, rot: 1 },
        { dx: 58, dy: 48, stories: 1, rot: 3 },
      ],
      treeOffsets: [
        { dx: 105, dy: -85, species: "neem" },
        { dx: -105, dy: 88, species: "oil-palm" },
      ],
    },
    {
      id: "s-west-mid",
      cx: -80,
      cy: 1020,
      width: 420,
      height: 240,
      houses: [
        { dx: -115, dy: -34, stories: 1, rot: 0 },
        { dx: 105, dy: 42, stories: 2, rot: 2 },
      ],
      treeOffsets: [
        { dx: 0, dy: -82, species: "oil-palm" },
        { dx: -180, dy: 88, species: "neem" },
      ],
    },
    {
      id: "s-central",
      cx: 880,
      cy: 1020,
      width: 520,
      height: 240,
      houses: [
        { dx: -165, dy: -35, stories: 2, rot: 2 },
        { dx: 5, dy: 40, stories: 1, rot: 0 },
        { dx: 170, dy: -35, stories: 2, rot: 3 },
      ],
      treeOffsets: [
        { dx: -85, dy: -85, species: "neem" },
        { dx: 95, dy: 85, species: "oil-palm" },
        { dx: 230, dy: 82, species: "neem" },
      ],
    },
    {
      id: "s-east",
      cx: 1580,
      cy: 1020,
      width: 410,
      height: 240,
      houses: [
        { dx: -105, dy: 38, stories: 2, rot: 1 },
        { dx: 100, dy: -38, stories: 1, rot: 0 },
      ],
      treeOffsets: [
        { dx: 0, dy: 85, species: "oil-palm" },
        { dx: -175, dy: -85, species: "neem" },
      ],
    },
    {
      id: "e-outer-north",
      cx: 2220,
      cy: 160,
      width: 440,
      height: 440,
      houses: [
        { dx: -115, dy: -110, stories: 2, rot: 0 },
        { dx: 110, dy: -90, stories: 1, rot: 1 },
        { dx: -105, dy: 115, stories: 1, rot: 2 },
        { dx: 115, dy: 120, stories: 2, rot: 3 },
      ],
      treeOffsets: [
        { dx: 0, dy: 0, species: "oil-palm" },
        { dx: -185, dy: 10, species: "neem" },
        { dx: 185, dy: 15, species: "oil-palm" },
      ],
    },
    {
      id: "e-outer-south",
      cx: 2220,
      cy: 1560,
      width: 440,
      height: 440,
      houses: [
        { dx: -110, dy: -110, stories: 1, rot: 3 },
        { dx: 110, dy: -100, stories: 2, rot: 0 },
        { dx: -100, dy: 110, stories: 2, rot: 2 },
        { dx: 115, dy: 115, stories: 1, rot: 1 },
      ],
      treeOffsets: [
        { dx: 0, dy: -170, species: "neem" },
        { dx: 10, dy: 170, species: "oil-palm" },
      ],
    },
    {
      id: "far-south-west",
      cx: -80,
      cy: 1560,
      width: 440,
      height: 440,
      houses: [
        { dx: -110, dy: -110, stories: 2, rot: 1 },
        { dx: 110, dy: -95, stories: 1, rot: 0 },
        { dx: -105, dy: 115, stories: 1, rot: 3 },
        { dx: 115, dy: 115, stories: 2, rot: 2 },
      ],
      treeOffsets: [
        { dx: 0, dy: 0, species: "neem" },
        { dx: -180, dy: 10, species: "oil-palm" },
      ],
    },
    {
      id: "far-south-central",
      cx: 880,
      cy: 1560,
      width: 520,
      height: 440,
      houses: [
        { dx: -155, dy: -110, stories: 1, rot: 0 },
        { dx: 15, dy: -100, stories: 2, rot: 2 },
        { dx: 165, dy: -105, stories: 1, rot: 1 },
        { dx: -145, dy: 110, stories: 2, rot: 3 },
        { dx: 155, dy: 110, stories: 2, rot: 0 },
      ],
      treeOffsets: [
        { dx: 0, dy: 120, species: "oil-palm" },
        { dx: -225, dy: 5, species: "neem" },
        { dx: 225, dy: 5, species: "oil-palm" },
      ],
    },
    {
      id: "far-south-east",
      cx: 1580,
      cy: 1560,
      width: 420,
      height: 440,
      houses: [
        { dx: -105, dy: -105, stories: 2, rot: 2 },
        { dx: 105, dy: -105, stories: 1, rot: 3 },
        { dx: -100, dy: 110, stories: 1, rot: 0 },
        { dx: 105, dy: 110, stories: 2, rot: 1 },
      ],
      treeOffsets: [
        { dx: 0, dy: 0, species: "oil-palm" },
        { dx: 180, dy: 5, species: "neem" },
      ],
    },
    {
      id: "deep-south-row-1",
      cx: -80,
      cy: 2200,
      width: 440,
      height: 360,
      houses: [
        { dx: -110, dy: -80, stories: 1, rot: 0 },
        { dx: 110, dy: 80, stories: 2, rot: 2 },
      ],
      treeOffsets: [{ dx: -180, dy: 90, species: "oil-palm" }],
    },
    {
      id: "deep-south-row-2",
      cx: 880,
      cy: 2200,
      width: 520,
      height: 360,
      houses: [
        { dx: -150, dy: -75, stories: 2, rot: 1 },
        { dx: 10, dy: 80, stories: 1, rot: 0 },
        { dx: 165, dy: -75, stories: 2, rot: 3 },
      ],
      treeOffsets: [
        { dx: -220, dy: 85, species: "neem" },
        { dx: 220, dy: 85, species: "oil-palm" },
      ],
    },
    {
      id: "deep-south-row-3",
      cx: 1580,
      cy: 2200,
      width: 420,
      height: 360,
      houses: [
        { dx: -105, dy: 75, stories: 1, rot: 2 },
        { dx: 105, dy: -75, stories: 2, rot: 0 },
      ],
      treeOffsets: [{ dx: 0, dy: 0, species: "oil-palm" }],
    },
    {
      id: "deep-east-mid",
      cx: 2800,
      cy: 800,
      width: 340,
      height: 520,
      houses: [
        { dx: -68, dy: -135, stories: 2, rot: 3 },
        { dx: 72, dy: 0, stories: 1, rot: 1 },
        { dx: -68, dy: 145, stories: 2, rot: 0 },
      ],
      treeOffsets: [
        { dx: 120, dy: -140, species: "oil-palm" },
        { dx: 120, dy: 150, species: "neem" },
      ],
    },
    {
      id: "deep-east-south",
      cx: 2800,
      cy: 2200,
      width: 340,
      height: 360,
      houses: [
        { dx: -70, dy: -70, stories: 1, rot: 2 },
        { dx: 75, dy: 80, stories: 2, rot: 0 },
      ],
      treeOffsets: [{ dx: -120, dy: 90, species: "oil-palm" }],
    },
  ];

  let buildingIndex = 0;
  let treeIndex = 0;
  const wallThickness = 10;

  for (const cluster of clusters) {
    const left = cluster.cx - cluster.width / 2;
    const right = cluster.cx + cluster.width / 2;
    const top = cluster.cy - cluster.height / 2;
    const bottom = cluster.cy + cluster.height / 2;

    // Concrete compound perimeter walls with a front gate gap on the south side.
    walls.push(
      { x: cluster.cx, y: top, width: cluster.width, height: wallThickness },
      { x: left, y: cluster.cy, width: wallThickness, height: cluster.height },
      { x: right, y: cluster.cy, width: wallThickness, height: cluster.height },
      {
        x: cluster.cx - cluster.width * 0.3,
        y: bottom,
        width: cluster.width * 0.4,
        height: wallThickness,
      },
      {
        x: cluster.cx + cluster.width * 0.3,
        y: bottom,
        width: cluster.width * 0.4,
        height: wallThickness,
      },
    );

    // Single grouped bounding collider for the entire residential compound cluster
    // keeps authoritative collision fast and draw-call overhead zero.
    obstacles.push({
      id: `perimeter-compound-${cluster.id}`,
      kind: "compound",
      x: cluster.cx,
      y: cluster.cy,
      width: cluster.width,
      height: cluster.height,
    });

    for (const house of cluster.houses) {
      const idx = buildingIndex++;
      buildings.push({
        x: cluster.cx + house.dx,
        y: cluster.cy + house.dy,
        width: house.stories === 2 ? 128 : 112,
        height: house.stories === 2 ? 96 : 86,
        stories: house.stories,
        rotationQuarterTurns: house.rot,
        wallColor: RESIDENTIAL_WALL_PALETTE[idx % RESIDENTIAL_WALL_PALETTE.length]!,
        roofVariant: idx % 3 === 0 ? "silver" : "laterite",
      });
    }

    for (const tree of cluster.treeOffsets) {
      const idx = treeIndex++;
      trees.push({
        x: cluster.cx + tree.dx,
        y: cluster.cy + tree.dy,
        species: tree.species,
        scale: 0.92 + ((idx * 17) % 28) / 100,
        rotation: (idx * 1.37) % (Math.PI * 2),
      });
    }
  }

  // Extra palm & neem clusters along the outer west & far-east green belts.
  const outerGroveCoords: readonly { x: number; y: number; species: "oil-palm" | "neem" }[] = [
    { x: -720, y: 120, species: "oil-palm" },
    { x: -700, y: 240, species: "neem" },
    { x: -690, y: 660, species: "oil-palm" },
    { x: -620, y: 720, species: "neem" },
    { x: -660, y: 1420, species: "oil-palm" },
    { x: -680, y: 1620, species: "neem" },
    { x: 1800, y: 310, species: "neem" },
    { x: 1800, y: 660, species: "oil-palm" },
    { x: 1960, y: 1020, species: "oil-palm" },
    { x: 2460, y: 1120, species: "neem" },
    { x: 2680, y: 310, species: "oil-palm" },
    { x: 2940, y: 1420, species: "neem" },
  ];
  outerGroveCoords.forEach((entry, index) => {
    trees.push({
      x: entry.x,
      y: entry.y,
      species: entry.species,
      scale: 0.95 + ((index * 19) % 25) / 100,
      rotation: (index * 1.1) % (Math.PI * 2),
    });
  });

  // Utility poles running cleanly along the major avenues without blocking driveways.
  const poleRuns: readonly (readonly { x: number; y: number; rotation: number }[])[] = [
    // Left Avenue west verge
    [
      { x: 442, y: -420, rotation: 0 },
      { x: 442, y: -60, rotation: 0 },
      { x: 442, y: 200, rotation: 0 },
      { x: 442, y: 600, rotation: 0 },
      { x: 442, y: 980, rotation: 0 },
      { x: 442, y: 1420, rotation: 0 },
    ],
    // Right Avenue east verge
    [
      { x: 1330, y: -420, rotation: 0 },
      { x: 1330, y: -60, rotation: 0 },
      { x: 1330, y: 600, rotation: 0 },
      { x: 1330, y: 980, rotation: 0 },
      { x: 1330, y: 1420, rotation: 0 },
    ],
    // East-West arterial south verge
    [
      { x: -300, y: 554, rotation: Math.PI / 2 },
      { x: 120, y: 554, rotation: Math.PI / 2 },
      { x: 560, y: 554, rotation: Math.PI / 2 },
      { x: 960, y: 554, rotation: Math.PI / 2 },
      { x: 1360, y: 554, rotation: Math.PI / 2 },
      { x: 1780, y: 554, rotation: Math.PI / 2 },
    ],
  ];

  const poles: PerimeterUtilityPole[] = [];
  const wireSpans: PerimeterWireSpan[] = [];
  for (const run of poleRuns) {
    for (let i = 0; i < run.length; i += 1) {
      const current = run[i]!;
      poles.push(current);
      const next = run[i + 1];
      if (next) {
        wireSpans.push({
          start: { x: current.x, y: current.y },
          end: { x: next.x, y: next.y },
        });
      }
    }
  }

  return {
    perimeter: { buildings, walls, trees, poles, wireSpans },
    obstacles,
  };
}

export function createCityCentreZoneLayout(): {
  zoneLayout: NeighborhoodZoneLayout;
  zoneObstacles: NeighborhoodObstacle[];
} {
  const { perimeter, obstacles: perimeterObstacles } = buildPerimeterLayout();

  const zones: NeighborhoodZoneRect[] = [
    {
      id: "zone-filling-station",
      tag: "FILLING_STATION",
      x: 708,
      y: 165,
      width: 332,
      height: 558,
      groundSurface: "stained-concrete",
    },
    {
      id: "zone-bank",
      tag: "BANK",
      x: 1084,
      y: 165,
      width: 318,
      height: 558,
      groundSurface: "interlocking-paving",
    },
    {
      id: "zone-adire-market-west",
      tag: "ADIRE_MARKET",
      x: -55,
      y: 155,
      width: 490,
      height: 530,
      groundSurface: "laterite",
    },
    {
      id: "zone-adire-market-south",
      tag: "ADIRE_MARKET",
      x: 245,
      y: 665,
      width: 370,
      height: 220,
      groundSurface: "laterite",
    },
    {
      id: "zone-commercial-shops",
      tag: "COMMERCIAL_SHOPS",
      x: 1565,
      y: 235,
      width: 465,
      height: 670,
      groundSurface: "asphalt-shoulder",
    },
    {
      id: "zone-perimeter-north",
      tag: "PERIMETER",
      x: 1120,
      y: -410,
      width: 3600,
      height: 460,
      groundSurface: "compound-yard",
    },
    {
      id: "zone-perimeter-south",
      tag: "PERIMETER",
      x: 1120,
      y: 1680,
      width: 3600,
      height: 1600,
      groundSurface: "compound-yard",
    },
  ];

  const fillingStation: FillingStationSpec = {
    zoneId: "zone-filling-station",
    forecourt: { x: 708, y: 205, width: 326, height: 470 },
    apron: { x: 562, y: 255, width: 52, height: 220 },
    canopy: { x: 668, y: 250, width: 146, height: 228 },
    pumpIslands: [
      { id: "fuel-pump-island-north", x: 668, y: 192, width: 72, height: 22 },
      { id: "fuel-pump-island-south", x: 668, y: 310, width: 72, height: 22 },
    ],
    miniMart: {
      x: 814,
      y: 255,
      width: 108,
      height: 220,
      doorCenterY: 255,
      doorWidth: 52,
      interiorBounds: { left: 760, right: 868, top: 145, bottom: 365 },
    },
    waterTank: { x: 830, y: 80, width: 38, height: 38 },
    vulcanizer: { x: 615, y: 412, radius: 28 },
    jerrycanStacks: [
      { x: 752, y: 118 },
      { x: 780, y: 118 },
    ],
    bollards: [
      { x: 590, y: 132 },
      { x: 590, y: 378 },
      { x: 745, y: 158 },
      { x: 745, y: 352 },
      { x: 742, y: 220 },
      { x: 742, y: 290 },
    ],
  };

  const bank: CommercialBankSpec = {
    zoneId: "zone-bank",
    courtyard: { x: 1084, y: 165, width: 316, height: 556 },
    building: { x: 1022, y: 48, width: 170, height: 200 },
    lobbyDoorCenterY: 16,
    lobbyDoorWidth: 54,
    lobbyBounds: { left: 937, right: 1107, top: -52, bottom: 148 },
    atmAlcove: { x: 1130, y: 110, width: 44, height: 74 },
    stanchions: [
      { x: 1166, y: 84 },
      { x: 1166, y: 112 },
      { x: 1166, y: 140 },
    ],
    pottedPalms: [
      { x: 1128, y: -38 },
      { x: 1128, y: 174 },
      { x: 1210, y: 196 },
    ],
    parkingLot: { x: 1082, y: 325, width: 300, height: 210 },
    securityPost: { x: 1196, y: 225, width: 38, height: 36 },
    parkedSedans: [
      { x: 985, y: 290, rotation: 0, color: "#345b82" },
      { x: 985, y: 375, rotation: 0, color: "#a84a36" },
      { x: 1088, y: 375, rotation: 0, color: "#4d6b57" },
    ],
    gateCenterY: 332,
    gateWidth: 96,
  };

  const adireMarket: AdireMarketSpec = {
    zoneId: "zone-adire-market-west",
    yards: [
      { x: -55, y: 155, width: 490, height: 530 },
      { x: 245, y: 665, width: 370, height: 220 },
    ],
    dyeShed: { x: -165, y: 50, width: 132, height: 96 },
    dyeVats: [
      { x: -195, y: 35 },
      { x: -160, y: 35 },
      { x: -125, y: 35 },
      { x: -195, y: 68 },
      { x: -160, y: 68 },
    ],
    dryingRacks: [
      { id: "adire-rack-1", x: 15, y: 40, rotation: 0, width: 104 },
      { id: "adire-rack-2", x: 15, y: 145, rotation: 0, width: 104 },
      { id: "adire-rack-3", x: -165, y: 215, rotation: Math.PI / 2, width: 104 },
      { id: "adire-rack-4", x: 190, y: 650, rotation: 0, width: 104 },
    ],
    marketTables: [
      { id: "adire-table-1", x: -65, y: 325, umbrellaColor: "#c94b36" },
      { id: "adire-table-2", x: 45, y: 325, umbrellaColor: "#16225C" },
      { id: "adire-table-3", x: 335, y: 665, umbrellaColor: "#d9822b" },
    ],
    bukaStall: { id: "adire-buka-stall", x: 165, y: 325, width: 76, height: 40 },
    crates: [
      { x: -115, y: 335 },
      { x: 92, y: 335 },
      { x: 280, y: 685 },
    ],
  };

  const commercialShops: CommercialShopsSpec = {
    zoneId: "zone-commercial-shops",
    shoulderBay: { x: 1358, y: 295, width: 64, height: 285 },
    shops: [
      {
        id: "shop-barber",
        kind: "barber",
        label: "DELE CUTZ BARBER",
        x: 1515,
        y: 65,
        width: 116,
        height: 104,
        accent: "#2563eb",
        walkIn: true,
        doorWidth: 46,
        interiorBounds: { left: 1457, right: 1573, top: 13, bottom: 117 },
      },
      {
        id: "shop-pos",
        kind: "pos",
        label: "FASTCASH POS",
        x: 1515,
        y: 190,
        width: 82,
        height: 62,
        accent: "#eab308",
      },
      {
        id: "shop-accessory",
        kind: "accessory",
        label: "IYA ADIRE ACCESSORIES",
        x: 1515,
        y: 345,
        width: 118,
        height: 106,
        accent: "#16a34a",
        walkIn: true,
        doorWidth: 46,
        interiorBounds: { left: 1456, right: 1574, top: 292, bottom: 398 },
      },
      {
        id: "shop-south-kiosk",
        kind: "pos",
        label: "KOROPE DISPATCH",
        x: 1515,
        y: 635,
        width: 96,
        height: 66,
        accent: "#d97706",
      },
    ],
    kekeVehicles: [
      { x: 1360, y: 205, rotation: 0, color: "#eab308" },
      { x: 1360, y: 270, rotation: 0, color: "#16a34a" },
    ],
    koropeBuses: [{ x: 1364, y: 370, rotation: 0 }],
  };

  // Explicit walk-in interior & prop colliders (never a solid box over open interiors!)
  const rawZoneObstacles: NeighborhoodObstacle[] = [
    // Filling station pump islands
    ...fillingStation.pumpIslands.map((island) => ({
      id: island.id,
      kind: "kiosk" as const,
      x: island.x,
      y: island.y,
      width: island.width,
      height: island.height,
    })),
    // Filling station mini-mart perimeter walls (open west doorway y=229..281)
    { id: "mart-wall-north", kind: "wall", x: 814, y: 150, width: 108, height: 10 },
    { id: "mart-wall-south", kind: "wall", x: 814, y: 360, width: 108, height: 10 },
    { id: "mart-wall-east", kind: "wall", x: 863, y: 255, width: 10, height: 220 },
    { id: "mart-wall-west-north", kind: "wall", x: 765, y: 187, width: 10, height: 84 },
    { id: "mart-wall-west-south", kind: "wall", x: 765, y: 323, width: 10, height: 84 },
    // Interior checkout counter & shelf rack (walkable paths all around)
    { id: "mart-counter", kind: "bench", x: 840, y: 205, width: 22, height: 64 },
    { id: "mart-aisle-rack", kind: "bench", x: 812, y: 315, width: 32, height: 16 },
    // Overhead water tank metal tower & vulcanizer corner
    {
      id: "fuel-water-tank-tower",
      kind: "wall",
      x: fillingStation.waterTank.x,
      y: fillingStation.waterTank.y,
      width: fillingStation.waterTank.width,
      height: fillingStation.waterTank.height,
    },
    {
      id: "fuel-vulcanizer-corner",
      kind: "kiosk",
      x: fillingStation.vulcanizer.x,
      y: fillingStation.vulcanizer.y,
      width: 44,
      height: 44,
    },
    {
      id: "fuel-jerrycans-cluster",
      kind: "bin",
      x: 766,
      y: 118,
      width: 36,
      height: 22,
    },
    // Commercial Bank walk-in perimeter walls (open east entrance doorway y=-11..43)
    { id: "bank-wall-north", kind: "wall", x: 1022, y: -47, width: 170, height: 10 },
    { id: "bank-wall-south", kind: "wall", x: 1022, y: 143, width: 170, height: 10 },
    { id: "bank-wall-west", kind: "wall", x: 942, y: 48, width: 10, height: 200 },
    { id: "bank-wall-east-north", kind: "wall", x: 1102, y: -31, width: 10, height: 42 },
    { id: "bank-wall-east-south", kind: "wall", x: 1102, y: 95, width: 10, height: 106 },
    // Bank interior teller counter & waiting bench (lobby center x=1005..1085 open)
    { id: "bank-teller-counter", kind: "bench", x: 966, y: 40, width: 22, height: 96 },
    { id: "bank-waiting-bench", kind: "bench", x: 1030, y: 110, width: 48, height: 18 },
    {
      id: "bank-security-post",
      kind: "kiosk",
      x: bank.securityPost.x,
      y: bank.securityPost.y,
      width: bank.securityPost.width,
      height: bank.securityPost.height,
    },
    { id: "bank-lot-fence-north", kind: "wall", x: 1222, y: 248, width: 10, height: 72 },
    { id: "bank-lot-fence-south", kind: "wall", x: 1222, y: 410, width: 10, height: 60 },
    { id: "bank-lot-fence-bottom", kind: "wall", x: 1080, y: 438, width: 280, height: 10 },
    ...bank.parkedSedans.map((sedan, index) => ({
      id: `bank-sedan-${index}`,
      kind: "bench" as const,
      x: sedan.x,
      y: sedan.y,
      width: 58,
      height: 30,
    })),
    // Adire Market Yard colliders (leaving wide paths between dye shed, racks, and tables)
    {
      id: "adire-dye-shed",
      kind: "kiosk",
      x: adireMarket.dyeShed.x,
      y: adireMarket.dyeShed.y,
      width: adireMarket.dyeShed.width,
      height: adireMarket.dyeShed.height,
    },
    ...adireMarket.dryingRacks.map((rack) => ({
      id: rack.id,
      kind: "wall" as const,
      x: rack.x,
      y: rack.y,
      width: rack.rotation === 0 ? rack.width : 18,
      height: rack.rotation === 0 ? 18 : rack.width,
    })),
    ...adireMarket.marketTables.map((table) => ({
      id: table.id,
      kind: "bench" as const,
      x: table.x,
      y: table.y,
      width: 52,
      height: 32,
    })),
    {
      id: adireMarket.bukaStall.id,
      kind: "kiosk",
      x: adireMarket.bukaStall.x,
      y: adireMarket.bukaStall.y,
      width: adireMarket.bukaStall.width,
      height: adireMarket.bukaStall.height,
    },
    // Commercial Shops & Transit Strip (walk-in walls for Barber & Accessory shops, solid kiosks for POS)
    ...commercialShops.shops.flatMap((shop): NeighborhoodObstacle[] => {
      if (!shop.walkIn) {
        return [
          {
            id: shop.id,
            kind: "kiosk",
            label: shop.label,
            x: shop.x,
            y: shop.y,
            width: shop.width,
            height: shop.height,
          },
        ];
      }
      const wallThick = 10;
      const doorW = shop.doorWidth ?? 46;
      const sideLen = (shop.height - doorW) / 2;
      const westX = shop.x - shop.width / 2 + wallThick / 2;
      const eastX = shop.x + shop.width / 2 - wallThick / 2;
      const northY = shop.y - shop.height / 2 + wallThick / 2;
      const southY = shop.y + shop.height / 2 - wallThick / 2;
      return [
        {
          id: `${shop.id}-wall-north`,
          kind: "wall",
          x: shop.x,
          y: northY,
          width: shop.width,
          height: wallThick,
        },
        {
          id: `${shop.id}-wall-south`,
          kind: "wall",
          x: shop.x,
          y: southY,
          width: shop.width,
          height: wallThick,
        },
        {
          id: `${shop.id}-wall-east`,
          kind: "wall",
          x: eastX,
          y: shop.y,
          width: wallThick,
          height: shop.height,
        },
        {
          id: `${shop.id}-wall-west-north`,
          kind: "wall",
          x: westX,
          y: shop.y - doorW / 2 - sideLen / 2,
          width: wallThick,
          height: sideLen,
        },
        {
          id: `${shop.id}-wall-west-south`,
          kind: "wall",
          x: westX,
          y: shop.y + doorW / 2 + sideLen / 2,
          width: wallThick,
          height: sideLen,
        },
        {
          id: `${shop.id}-interior-counter`,
          kind: "bench",
          x: shop.x + shop.width / 2 - 22,
          y: shop.y,
          width: 18,
          height: 46,
        },
      ];
    }),
    ...commercialShops.kekeVehicles.map((keke, index) => ({
      id: `transit-keke-${index}`,
      kind: "bench" as const,
      x: keke.x,
      y: keke.y,
      width: 34,
      height: 44,
    })),
    ...commercialShops.koropeBuses.map((bus, index) => ({
      id: `transit-korope-${index}`,
      kind: "bench" as const,
      x: bus.x,
      y: bus.y,
      width: 44,
      height: 76,
    })),
    ...perimeterObstacles,
  ];

  const zoneManagedObstacles: NeighborhoodObstacle[] = rawZoneObstacles.map((obstacle) => ({
    ...obstacle,
    visualManaged: true,
  }));

  const zoneObstacles: NeighborhoodObstacle[] = [
    ...zoneManagedObstacles,
    // Standalone street furniture & wayfinding rendered by WorldStreetFurniture
    { id: "streetlight-crossing-west", kind: "streetlight", x: 430, y: 430, width: 20, height: 20 },
    { id: "streetlight-crossing-east", kind: "streetlight", x: 562, y: 560, width: 20, height: 20 },
    { id: "bench-neighbourhood-square", kind: "bench", x: 30, y: 565, width: 56, height: 24 },
    { id: "bin-crossing", kind: "bin", x: 96, y: 565, width: 22, height: 22 },
    {
      id: "olaiya-wayfinding",
      kind: "sign",
      label: "OLAIYA JUNCTION",
      x: 452,
      y: 432,
      width: 32,
      height: 24,
    },
  ];

  const drivewayCutouts: DrivewayCutout[] = [
    // Filling station driveway apron opening on east side of Left Avenue
    {
      id: "cutout-filling-station-apron",
      roadId: "olaiya-arterial-north-south",
      side: 1,
      start: 145,
      end: 365,
    },
    // Service alley openings on north & south avenues
    {
      id: "cutout-alley-north",
      roadId: "north-compound-lane",
      side: 1,
      start: 865,
      end: 935,
    },
    {
      id: "cutout-alley-south",
      roadId: "olaiya-arterial-east-west",
      side: -1,
      start: 865,
      end: 935,
    },
    // Bank parking gate opening on west side of Right Avenue
    {
      id: "cutout-bank-gate",
      roadId: "east-market-street",
      side: -1,
      start: 278,
      end: 388,
    },
    // Keke / Korope loading shoulder bay on east side of Right Avenue
    {
      id: "cutout-transit-shoulder",
      roadId: "east-market-street",
      side: 1,
      start: 150,
      end: 440,
    },
  ];

  return {
    zoneLayout: {
      zones,
      serviceAlley: { x: 900, y: 165, width: 50, height: 593 },
      drivewayCutouts,
      fillingStation,
      bank,
      adireMarket,
      commercialShops,
      perimeter,
    },
    zoneObstacles,
  };
}
