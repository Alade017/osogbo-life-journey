export type VenueFixtureKind =
  "counter" | "table" | "bench" | "shelf" | "screen" | "display" | "planter" | "seat";

export type VenueFixture = {
  id: string;
  label: string;
  detail: string;
  kind: VenueFixtureKind;
  position: [number, number];
};

/** A restyled environment model for a venue interior, from public/models/environments. */
export type VenueEnvironment = {
  url: string;
  /** Hours (game clock) when the trading shutter is up. Omit for venues without a shutter. */
  trading?: { openHour: number; closeHour: number };
};

export type LocationVenueDesign = {
  name: string;
  description: string;
  floorColor: string;
  wallColor: string;
  accentColor: string;
  fixtures: readonly VenueFixture[];
  environment?: VenueEnvironment;
};

/** True while a venue with trading hours is open at this game hour. */
export function isTradingOpen(hour: number, trading: VenueEnvironment["trading"]) {
  if (!trading) return true;
  return hour >= trading.openHour && hour < trading.closeHour;
}

function fixture(
  id: string,
  label: string,
  detail: string,
  kind: VenueFixtureKind,
  x: number,
  z: number,
): VenueFixture {
  return { id, label, detail, kind, position: [x, z] };
}

const venues: Readonly<Record<string, LocationVenueDesign>> = {
  "oja-oba": {
    name: "Oja-Oba trading hall",
    description:
      "An Osogbo-inspired covered market interior with produce, staple-goods and household trading spaces.",
    floorColor: "#cdbb92",
    wallColor: "#e5d3ad",
    accentColor: "#c77a3b",
    fixtures: [
      fixture(
        "oja-oba-produce-counter",
        "Fresh produce counter",
        "A shaded trading counter for fruit and fresh vegetables.",
        "counter",
        -2.7,
        -0.5,
      ),
      fixture(
        "oja-oba-staples-shelves",
        "Grains and staples shelves",
        "Shelving for grains, beans and everyday dry goods.",
        "shelf",
        2.7,
        -0.5,
      ),
      fixture(
        "oja-oba-household-table",
        "Household goods display",
        "A shared display table for practical household items.",
        "table",
        0,
        0.9,
      ),
      fixture(
        "oja-oba-trader-seats",
        "Trader seating",
        "A small shared resting place beside the market aisle.",
        "seat",
        0,
        -2.1,
      ),
    ],
  },
  "town-market": {
    name: "Market aisles",
    environment: { url: "/models/environments/market-and-bank/seafood-market-stall.glb" },
    description: "A covered trading floor with produce stalls and a shared aisle.",
    floorColor: "#cdbb92",
    wallColor: "#e5d3ad",
    accentColor: "#c77a3b",
    fixtures: [
      fixture(
        "produce-stall",
        "Produce stall",
        "A shaded counter for market goods.",
        "counter",
        -2.7,
        -0.5,
      ),
      fixture("market-table", "Market table", "A central display table.", "table", 0, 0.8),
      fixture(
        "market-shelves",
        "Dry goods shelves",
        "Shelves line the back of the aisle.",
        "shelf",
        2.7,
        -0.5,
      ),
    ],
  },
  "civic-court": {
    name: "Civic service hall",
    description: "A bright public counter with visitor seating and a notice display.",
    floorColor: "#d5d5ca",
    wallColor: "#e7e5d9",
    accentColor: "#527d82",
    fixtures: [
      fixture("public-counter", "Public counter", "The main service desk.", "counter", 0, -1.6),
      fixture("visitor-seats", "Visitor seats", "A small waiting area.", "seat", -2.8, 1),
      fixture(
        "civic-noticeboard",
        "Notice display",
        "Public information is displayed here.",
        "screen",
        2.8,
        0.8,
      ),
    ],
  },
  "community-police": {
    name: "Community help desk",
    description: "A neighbourhood service room with a front desk and briefing space.",
    floorColor: "#d0d2c8",
    wallColor: "#e1e2d9",
    accentColor: "#607c84",
    fixtures: [
      fixture(
        "front-desk",
        "Front desk",
        "The station's public information desk.",
        "counter",
        -2.5,
        -1,
      ),
      fixture("briefing-table", "Briefing table", "A shared table for staff.", "table", 0.4, 0.6),
      fixture(
        "community-board",
        "Community board",
        "Local notices and safety information.",
        "screen",
        2.8,
        -0.6,
      ),
    ],
  },
  "cedar-bank": {
    name: "Cedar Bank lobby",
    description: "A calm banking lobby with a teller counter and queue seating.",
    floorColor: "#d5d1c5",
    wallColor: "#e6e1d4",
    accentColor: "#4b806f",
    fixtures: [
      fixture("cedar-teller", "Teller counter", "A staffed service counter.", "counter", 0, -1.6),
      fixture("cedar-queue", "Queue seats", "Seats beside the service queue.", "seat", -2.8, 0.9),
      fixture(
        "cedar-info",
        "Information screen",
        "A display for branch information.",
        "screen",
        2.8,
        0.8,
      ),
    ],
  },
  "meridian-bank": {
    name: "Meridian Bank lobby",
    description: "A modern branch lobby with self-service points and a private desk.",
    floorColor: "#c8d2d0",
    wallColor: "#e3e9e5",
    accentColor: "#527c9b",
    fixtures: [
      fixture(
        "meridian-service",
        "Service desk",
        "A private customer service point.",
        "counter",
        2.5,
        -1.4,
      ),
      fixture(
        "meridian-kiosk",
        "Self-service kiosk",
        "A simple branch information terminal.",
        "screen",
        -2.5,
        -0.8,
      ),
      fixture("meridian-seating", "Waiting seats", "A small seating area.", "seat", 0, 1.1),
    ],
  },
  "lantern-club": {
    name: "Lantern Club lounge",
    description: "A warm lounge with a small stage, low tables and a refreshment bar.",
    floorColor: "#453b39",
    wallColor: "#725b50",
    accentColor: "#d18b4d",
    fixtures: [
      fixture(
        "club-bar",
        "Refreshment bar",
        "The lounge's service counter.",
        "counter",
        -2.6,
        -1.2,
      ),
      fixture("club-stage", "Small stage", "A raised performance corner.", "display", 2.5, -1.4),
      fixture("club-tables", "Lounge tables", "Shared tables for visitors.", "table", 0, 1),
    ],
  },
  "community-clinic": {
    name: "Community clinic",
    description: "A clean reception and care area with clear visitor seating.",
    floorColor: "#d0ded8",
    wallColor: "#e7efeb",
    accentColor: "#568d79",
    fixtures: [
      fixture(
        "clinic-reception",
        "Reception",
        "The clinic's information counter.",
        "counter",
        -2.7,
        -1.2,
      ),
      fixture("clinic-care", "Care station", "A simple treatment station.", "display", 2.5, -1.2),
      fixture("clinic-seats", "Waiting seats", "Visitor seating near reception.", "seat", 0, 1),
    ],
  },
  "transit-park": {
    name: "Transit concourse",
    description: "A practical transit waiting area beside route information and ticketing.",
    floorColor: "#c9c7bc",
    wallColor: "#dfded5",
    accentColor: "#58818a",
    fixtures: [
      fixture(
        "transit-bench",
        "Platform bench",
        "A long shared waiting bench.",
        "bench",
        -2.7,
        0.8,
      ),
      fixture(
        "transit-board",
        "Route board",
        "A display for route information.",
        "screen",
        0,
        -1.5,
      ),
      fixture(
        "transit-counter",
        "Ticket counter",
        "A compact passenger service counter.",
        "counter",
        2.7,
        0.8,
      ),
    ],
  },
  "osun-mall": {
    name: "Mall gallery",
    description: "A compact shopping gallery with display plinths and a seating nook.",
    floorColor: "#d4d0c6",
    wallColor: "#ece8de",
    accentColor: "#ba7051",
    fixtures: [
      fixture("mall-display", "Featured display", "A central retail display.", "display", 0, -1.3),
      fixture(
        "mall-shelves",
        "Shop shelves",
        "Shelving along one side of the gallery.",
        "shelf",
        -2.7,
        0.7,
      ),
      fixture("mall-seats", "Gallery seats", "A quiet place to pause.", "seat", 2.7, 0.8),
    ],
  },
  "sports-ground": {
    name: "Sports pavilion",
    description: "A small pavilion opening onto a marked practice area.",
    floorColor: "#8da17c",
    wallColor: "#d4ddc9",
    accentColor: "#718d58",
    fixtures: [
      fixture(
        "sports-bench",
        "Team bench",
        "A shared bench at the edge of the field.",
        "bench",
        -2.7,
        0.8,
      ),
      fixture("sports-board", "Score display", "A simple field-side display.", "screen", 0, -1.5),
      fixture(
        "sports-equipment",
        "Equipment rack",
        "A rack for shared sports equipment.",
        "shelf",
        2.7,
        0.7,
      ),
    ],
  },
  "riverside-food-court": {
    name: "Riverside food court",
    description: "An open-sided dining room with vendor counters and shared tables.",
    floorColor: "#c7b99c",
    wallColor: "#e3d8c2",
    accentColor: "#bd7b48",
    fixtures: [
      fixture(
        "riverside-counter",
        "Vendor counter",
        "A food service counter.",
        "counter",
        -2.7,
        -1.3,
      ),
      fixture(
        "riverside-tables",
        "Shared tables",
        "Tables in the centre of the food court.",
        "table",
        0,
        0.8,
      ),
      fixture(
        "riverside-planter",
        "Courtyard planter",
        "A planted edge beside the open side.",
        "planter",
        2.8,
        -0.6,
      ),
    ],
  },
  "sunrise-health-post": {
    name: "Sunrise health post",
    description: "A small health post with reception, care space and patient seating.",
    floorColor: "#d2e0d7",
    wallColor: "#e9f0e9",
    accentColor: "#5c9679",
    fixtures: [
      fixture(
        "sunrise-reception",
        "Reception",
        "The health post information desk.",
        "counter",
        -2.7,
        -1.2,
      ),
      fixture("sunrise-care", "Care station", "A compact care area.", "display", 2.7, -1.2),
      fixture("sunrise-seats", "Patient seating", "A small waiting area.", "seat", 0, 0.9),
    ],
  },
  "harvest-tech-hub": {
    name: "Harvest Tech Hub",
    description: "A practical learning lab with shared worktables and a presentation screen.",
    floorColor: "#c8d5d0",
    wallColor: "#e0e9e3",
    accentColor: "#4d8c80",
    fixtures: [
      fixture("tech-worktable", "Worktable", "A shared workspace.", "table", -2.5, 0.8),
      fixture(
        "tech-screen",
        "Presentation screen",
        "A display at the front of the room.",
        "screen",
        0,
        -1.5,
      ),
      fixture(
        "tech-shelf",
        "Equipment shelf",
        "Storage for learning equipment.",
        "shelf",
        2.8,
        0.6,
      ),
    ],
  },
  "old-town-library": {
    name: "Old Town Library",
    description: "A quiet reading room with book stacks, a help desk and study seats.",
    floorColor: "#bcae91",
    wallColor: "#e1d6be",
    accentColor: "#7b6149",
    fixtures: [
      fixture(
        "library-stacks",
        "Book stacks",
        "Shelves along the reading room.",
        "shelf",
        -2.7,
        -0.4,
      ),
      fixture("library-desk", "Library desk", "A reader help desk.", "counter", 2.7, -1),
      fixture("library-table", "Study table", "A shared reading table.", "table", 0, 1),
    ],
  },
  "garden-chapel": {
    name: "Garden chapel courtyard",
    description: "A quiet courtyard with a small gathering area and planted edges.",
    floorColor: "#c8c3aa",
    wallColor: "#e7e2d0",
    accentColor: "#8a9b70",
    fixtures: [
      fixture(
        "chapel-seats",
        "Gathering seats",
        "Seats arranged for a community gathering.",
        "seat",
        -2.7,
        0.5,
      ),
      fixture(
        "chapel-lectern",
        "Reading stand",
        "A simple stand at the front.",
        "display",
        0,
        -1.4,
      ),
      fixture(
        "chapel-garden",
        "Garden planter",
        "A planted corner of the courtyard.",
        "planter",
        2.8,
        0.6,
      ),
    ],
  },
  "fish-market": {
    name: "Fish market hall",
    description: "A wash-down market hall with vendor counters and display tables.",
    floorColor: "#bac5c1",
    wallColor: "#dce3df",
    accentColor: "#648b91",
    environment: {
      url: "/models/environments/market-and-bank/fish-market-bay.glb",
      trading: { openHour: 7, closeHour: 19 },
    },
    fixtures: [
      fixture("fish-counter", "Vendor counter", "A market service counter.", "counter", -2.7, -1.2),
      fixture("fish-display", "Display table", "A washable display surface.", "table", 0, 0.7),
      fixture("fish-shelves", "Storage rack", "A rack for market supplies.", "shelf", 2.7, -0.5),
    ],
  },
  "lagoon-hotel": {
    name: "Lagoon Hotel lobby",
    description: "A relaxed lobby with a reception desk and a small seating area.",
    floorColor: "#b8c5bd",
    wallColor: "#e0e6dc",
    accentColor: "#568a7a",
    fixtures: [
      fixture("hotel-reception", "Reception desk", "The lobby's front desk.", "counter", 0, -1.5),
      fixture(
        "hotel-seating",
        "Lounge seats",
        "A small waiting and lounge area.",
        "seat",
        -2.7,
        0.8,
      ),
      fixture(
        "hotel-planter",
        "Lobby planter",
        "A planted accent beside the seating.",
        "planter",
        2.8,
        0.7,
      ),
    ],
  },
  "cinema-star": {
    name: "Cinema Star",
    description: "A compact screening room with a clear screen and tiered seating.",
    floorColor: "#393941",
    wallColor: "#554d5a",
    accentColor: "#b27a53",
    fixtures: [
      fixture("cinema-screen", "Screen", "The front screen of the room.", "screen", 0, -1.8),
      fixture("cinema-seats", "Screening seats", "Seats facing the screen.", "seat", -2.7, 0.8),
      fixture(
        "cinema-aisle",
        "Aisle marker",
        "A low marker beside the central aisle.",
        "display",
        2.7,
        0.7,
      ),
    ],
  },
  "fuel-and-go": {
    name: "Fuel and Go service bay",
    description: "A compact forecourt office with a service counter and route board.",
    floorColor: "#c8c8be",
    wallColor: "#e1e0d7",
    accentColor: "#b67843",
    fixtures: [
      fixture("fuel-counter", "Service counter", "The forecourt office desk.", "counter", -2.7, -1),
      fixture("fuel-pump", "Pump island", "A model of the forecourt pump.", "display", 0, 0.7),
      fixture("fuel-board", "Travel board", "A notice display for travellers.", "screen", 2.7, -1),
    ],
  },
  "youth-arts-centre": {
    name: "Youth Arts Centre studio",
    description: "A bright community studio with shared worktables and a gallery wall.",
    floorColor: "#d8cdbb",
    wallColor: "#eee4d3",
    accentColor: "#bd7359",
    fixtures: [
      fixture(
        "arts-worktable",
        "Studio worktable",
        "A shared creative workspace.",
        "table",
        -2.7,
        0.8,
      ),
      fixture(
        "arts-gallery",
        "Gallery display",
        "A wall display for local work.",
        "display",
        0,
        -1.6,
      ),
      fixture(
        "arts-supply",
        "Supply shelf",
        "A shelf for shared studio materials.",
        "shelf",
        2.7,
        0.7,
      ),
    ],
  },
  "post-office": {
    name: "Post office lobby",
    description: "A neighbourhood post office with a counter and a public notice area.",
    floorColor: "#d2cfc0",
    wallColor: "#e8e4d7",
    accentColor: "#a76d4b",
    fixtures: [
      fixture(
        "post-counter",
        "Postal counter",
        "The main counter for visitors.",
        "counter",
        -2.7,
        -1.1,
      ),
      fixture("post-box", "Mail drop", "A collection point beside the counter.", "display", 0, 0.7),
      fixture("post-seats", "Waiting bench", "A short waiting bench.", "bench", 2.7, 0.8),
    ],
  },
  "mosque-square": {
    name: "Mosque Square courtyard",
    description: "An open courtyard with shaded seating and a planted edge.",
    floorColor: "#c8c4ae",
    wallColor: "#e4e0d0",
    accentColor: "#829477",
    fixtures: [
      fixture("mosque-seating", "Courtyard seating", "A shaded place to sit.", "bench", -2.7, 0.8),
      fixture(
        "mosque-planter",
        "Garden edge",
        "A low planted courtyard border.",
        "planter",
        2.7,
        0.8,
      ),
      fixture(
        "mosque-information",
        "Community information",
        "A simple visitor information stand.",
        "display",
        0,
        -1.4,
      ),
    ],
  },
  "east-transit-terminal": {
    name: "East Transit Terminal",
    description: "A broad passenger concourse with route information and a sheltered platform.",
    floorColor: "#c5c6bd",
    wallColor: "#dcdfd5",
    accentColor: "#4e7e89",
    fixtures: [
      fixture(
        "terminal-counter",
        "Passenger desk",
        "A help point for travellers.",
        "counter",
        -2.7,
        -1,
      ),
      fixture(
        "terminal-board",
        "Route board",
        "Departures and route information.",
        "screen",
        0,
        -1.5,
      ),
      fixture(
        "terminal-bench",
        "Platform seating",
        "Sheltered seating beside the concourse.",
        "bench",
        2.7,
        0.8,
      ),
    ],
  },
  "eastside-produce-coop": {
    name: "Eastside Produce Co-op",
    description: "A cooperative market floor for growers, buyers and shared produce displays.",
    floorColor: "#c8bd9b",
    wallColor: "#e5d9bb",
    accentColor: "#78854e",
    fixtures: [
      fixture(
        "produce-coop-counter",
        "Co-op counter",
        "A shared produce service counter.",
        "counter",
        -2.7,
        -1.2,
      ),
      fixture(
        "produce-coop-table",
        "Produce display",
        "A central table for market goods.",
        "table",
        0,
        0.7,
      ),
      fixture(
        "produce-coop-planter",
        "Garden crates",
        "A planted edge for the open market.",
        "planter",
        2.7,
        0.7,
      ),
    ],
  },
  "adire-makers-yard": {
    name: "Adire Makers' Yard",
    description: "A textile workshop with shared worktables, materials and finished pieces.",
    floorColor: "#c9b8a4",
    wallColor: "#e7d8c6",
    accentColor: "#8c5c74",
    fixtures: [
      fixture(
        "adire-worktable",
        "Dye worktable",
        "A shared surface for textile work.",
        "table",
        -2.7,
        0.8,
      ),
      fixture(
        "adire-materials",
        "Textile shelf",
        "Materials and tools for the workshop.",
        "shelf",
        2.7,
        0.7,
      ),
      fixture(
        "adire-gallery",
        "Finished textiles",
        "A display for completed patterns.",
        "display",
        0,
        -1.6,
      ),
    ],
  },
  "neighborhood-play-park": {
    name: "Neighbourhood Play Park",
    description: "An open community recreation space with seating and planted edges.",
    floorColor: "#91a47e",
    wallColor: "#d7e0cb",
    accentColor: "#5b8154",
    fixtures: [
      fixture(
        "play-park-seats",
        "Park seating",
        "A place for visitors to rest.",
        "bench",
        -2.7,
        0.8,
      ),
      fixture(
        "play-park-feature",
        "Play area",
        "A small shared recreation area.",
        "display",
        0,
        -1.3,
      ),
      fixture(
        "play-park-garden",
        "Garden edge",
        "Planting along the park boundary.",
        "planter",
        2.7,
        0.7,
      ),
    ],
  },
};

const fallbackVenue: LocationVenueDesign = {
  name: "Neighbourhood space",
  description: "A welcoming local space with a shared table, a service point and visitor seating.",
  floorColor: "#cbbd9e",
  wallColor: "#e6dece",
  accentColor: "#8b8067",
  fixtures: [
    fixture("shared-table", "Shared table", "A central place to gather.", "table", 0, 0.8),
    fixture(
      "local-counter",
      "Local counter",
      "A simple neighborhood service point.",
      "counter",
      -2.7,
      -1,
    ),
    fixture("visitor-seat", "Visitor seating", "A place to pause.", "seat", 2.7, 0.7),
  ],
};

export function getLocationVenueDesign(slug: string, locationName: string): LocationVenueDesign {
  const design = venues[slug] ?? fallbackVenue;
  return design === fallbackVenue ? { ...fallbackVenue, name: locationName } : design;
}

export function hasLocationVenueDesign(slug: string) {
  return Object.hasOwn(venues, slug);
}

/**
 * A null shop slug marks a sub-building stall without its own enterable interior.
 * Undefined keeps the legacy district-wide venue behaviour for existing locations.
 */
export function hasBuildingVenueInterior(locationSlug: string, shopSlug?: string | null) {
  return shopSlug !== null && hasLocationVenueDesign(locationSlug);
}

/** Mount a venue only when the character query confirms the server-saved location. */
export function hasAuthoritativeLocationArrival(
  currentLocationId: string | null | undefined,
  destinationLocationId: string | null | undefined,
) {
  return (
    typeof currentLocationId === "string" &&
    currentLocationId.length > 0 &&
    currentLocationId === destinationLocationId
  );
}
