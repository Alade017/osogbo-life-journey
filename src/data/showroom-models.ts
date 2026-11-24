import type { ShowroomLandmarkId } from "./showroom-destinations";

// IDs correspond to the supplied procedural GLB pack. Binary assets are staged separately.
const modelIds = {
  "fuel-station": [
    "civic-1998",
    "corolla-2000",
    "accord-2005",
    "camry-2008",
    "c300-2014",
    "rx350-2015",
    "ivm-g5-2021",
    "prado-2024",
    "yaris-2007",
    "rav4-2014",
    "highlander-2018",
    "hilux-2022",
    "range-rover-2025",
    "g63-2025",
    "keke",
    "okada",
    "commercial-minibus"
  ],
  "cinema-event-hall": [
    "911-gt3-2025",
    "urus-se-2026",
    "temerario-2026",
    "296-gtb-2026",
    "purosangue-2026",
    "revuelto-2026",
    "revuelto-yellow-2026"
  ],
  "post-office-cafe": [
    "crt-14",
    "led-24",
    "digital-32",
    "smart-43",
    "oled-55",
    "oled-65"
  ],
  "harvest-tech-hub": [
    "pavilion-15",
    "thinkpad-t480",
    "latitude-7490",
    "elitebook-840",
    "macbook-air-m2",
    "zephyrus-g16",
    "macbook-pro-m4",
    "ultrabook-14",
    "optiplex-7050",
    "all-in-one-24",
    "imac-m3",
    "gaming-rig"
  ]
} satisfies Record<ShowroomLandmarkId, readonly string[]>;

export function getShowroomModels(id: ShowroomLandmarkId) {
  return modelIds[id].map((modelId) => ({ id: modelId, label: modelId.replaceAll("-", " "), url: `/models/showrooms/${modelId}.glb` }));
}
