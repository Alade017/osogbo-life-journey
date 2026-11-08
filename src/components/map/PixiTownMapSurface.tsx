import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as PIXI from "pixi.js";
import townData from "@/data/osogbo-town.json";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import type {
  MapBillboardMarker,
  MapPlayerLocation,
  MapProperty,
} from "@/components/map/MapCanvas";

export interface PixiTownMapProps {
  places?: readonly (typeof townData.landmarks)[number][] | undefined;
  properties?: readonly MapProperty[] | undefined;
  playerLocation?: MapPlayerLocation | null | undefined;
  billboardMarkers?: readonly MapBillboardMarker[] | undefined;
  onSelectLandmark: (id: string) => void;
  onSelectDistrict: (id: string) => void;
  onSelectBillboard?: ((campaignId: string) => void) | undefined;
  onSelectProperty?: ((property: MapProperty) => void) | undefined;
  eventChips?: readonly { id: string; label: string; x: number; y: number }[] | undefined;
  onSelectEvent?: ((landmarkId: string) => void) | undefined;
  onReady?: (() => void) | undefined;
  onUnavailable?: (() => void) | undefined;
}

// Isometric Configuration (Standard 2:1 ratio for architectural clarity)
const ISO_TILE_WIDTH = 64;
const ISO_TILE_HEIGHT = 32;

/** Transforms grid cell (col, row) to isometric world coordinates */
function gridToIso(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (ISO_TILE_WIDTH / 2),
    y: (col + row) * (ISO_TILE_HEIGHT / 2),
  };
}

const DISTRICT_EMOJIS: Record<string, string> = {
  "market-quarter": "🛍️",
  "civic-quarter": "🏛️",
  "commerce-quarter": "💼",
  "central-crossing": "🚖",
  "garden-quarter": "🌳",
  "learning-quarter": "📚",
  "transit-quarter": "🚌",
  "open-fields": "⚽",
  "river-quarter": "🌊",
  "south-quarter": "🏘️",
  "hospital-quarter": "🏥",
};

const LANDMARK_EMOJIS: Record<string, string> = {
  "town-market": "🛍️",
  "civic-court": "🏛️",
  "community-police": "👮",
  "cedar-bank": "🏦",
  "meridian-bank": "🏦",
  "lantern-club": "🍸",
  "community-clinic": "🏥",
  "transit-park": "🚌",
  "osun-mall": "🏬",
  "sports-ground": "⚽",
  "riverside-food-court": "🍽️",
};

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function PixiTownMapSurface({
  places = townData.landmarks,
  properties = [],
  playerLocation,
  billboardMarkers: _billboardMarkers = [],
  onSelectLandmark,
  onSelectDistrict,
  onSelectBillboard: _onSelectBillboard,
  onSelectProperty,
  eventChips = [],
  onSelectEvent,
  onReady,
  onUnavailable,
}: PixiTownMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [initError, setInitError] = useState(false);
  const zoomLevel = useRef(1.15);

  useEffect(() => {
    if (typeof window === "undefined" || !hostRef.current) {
      onUnavailable?.();
      return;
    }

    let isDisposed = false;
    let app: PIXI.Application | null = null;
    let onPointerDown: ((e: PointerEvent) => void) | null = null;
    let onPointerMove: ((e: PointerEvent) => void) | null = null;
    let onPointerUp: (() => void) | null = null;
    let onWheel: ((e: WheelEvent) => void) | null = null;

    async function initPixiEngine() {
      try {
        const host = hostRef.current;
        if (!host) return;

        app = new PIXI.Application();
        await app.init({
          resizeTo: host,
          backgroundColor: 0xd9c9ad, // Authentic warm ground tone from WORLD_PALETTE
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          antialias: true,
        });

        if (isDisposed) {
          app.destroy(true, { children: true });
          return;
        }

        host.appendChild(app.canvas);

        // ====================================================================
        // 1. LAYER SEPARATION SYSTEM
        // ====================================================================
        // rootContainer: handles panning and zooming
        const rootContainer = new PIXI.Container();
        // worldContainer: holds ground tiles, roads, drainage, buildings, and vehicles (depth sorted)
        const worldContainer = new PIXI.Container();
        // uiOverlayContainer: floating screen-space labels and pins (always on top)
        const uiOverlayContainer = new PIXI.Container();

        app.stage.addChild(rootContainer);
        rootContainer.addChild(worldContainer);
        rootContainer.addChild(uiOverlayContainer);

        // Center map camera to viewport
        const centerWorld = () => {
          if (!app) return;
          rootContainer.x = app.screen.width / 2;
          rootContainer.y = app.screen.height / 3.8;
          rootContainer.scale.set(zoomLevel.current);
        };
        centerWorld();

        window.addEventListener("resize", centerWorld);

        // ====================================================================
        // 2. PAN & ZOOM CONTROLS (MOUSE & TOUCH DRAG)
        // ====================================================================
        let isDragging = false;
        let dragOrigin = { x: 0, y: 0 };
        let containerOrigin = { x: 0, y: 0 };
        let hasMoved = false;

        onPointerDown = (e: PointerEvent) => {
          isDragging = true;
          hasMoved = false;
          dragOrigin = { x: e.clientX, y: e.clientY };
          containerOrigin = { x: rootContainer.x, y: rootContainer.y };
        };

        onPointerMove = (e: PointerEvent) => {
          if (!isDragging) return;
          const dx = e.clientX - dragOrigin.x;
          const dy = e.clientY - dragOrigin.y;
          if (Math.hypot(dx, dy) > 4) hasMoved = true;
          rootContainer.x = containerOrigin.x + dx;
          rootContainer.y = containerOrigin.y + dy;
        };

        onPointerUp = () => {
          isDragging = false;
        };

        onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const zoomDelta = e.deltaY < 0 ? 1.08 : 0.92;
          const newZoom = Math.min(2.2, Math.max(0.65, zoomLevel.current * zoomDelta));
          zoomLevel.current = newZoom;
          rootContainer.scale.set(newZoom);
        };

        host.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        host.addEventListener("wheel", onWheel, { passive: false });

        // ====================================================================
        // 3. GROUND TILES, ROADS, AND DRAINAGE SYSTEM
        // ====================================================================
        const groundGraphics = new PIXI.Graphics();
        const roadGraphics = new PIXI.Graphics();
        const drainageGraphics = new PIXI.Graphics();
        const riverGraphics = new PIXI.Graphics();

        const gridCols = townData.grid.rows[0]?.length ?? 24;
        const gridRows = townData.grid.rows.length;

        // Ground base diamond helper
        const drawDiamond = (
          g: PIXI.Graphics,
          cx: number,
          cy: number,
          fillColor: number,
          fillAlpha = 1,
          strokeColor?: number,
          strokeWidth = 1,
        ) => {
          const hw = ISO_TILE_WIDTH / 2;
          const hh = ISO_TILE_HEIGHT / 2;
          g.poly([cx, cy - hh, cx + hw, cy, cx, cy + hh, cx - hw, cy]);
          g.fill({ color: fillColor, alpha: fillAlpha });
          if (strokeColor !== undefined) {
            g.stroke({ width: strokeWidth, color: strokeColor });
          }
        };

        for (let r = 0; r < gridRows; r++) {
          const rowStr = townData.grid.rows[r] ?? "";
          for (let c = 0; c < gridCols; c++) {
            const cellType = rowStr[c] ?? "g";
            const { x: cx, y: cy } = gridToIso(c, r);

            if (cellType === "r") {
              // ASPHALT ROAD TILE
              drawDiamond(roadGraphics, cx, cy, 0x475569, 1, 0x64748b, 0.5);

              // Road Shoulder Drainage Gutter (Concrete-lined ditches along edges)
              const hw = ISO_TILE_WIDTH / 2;
              const hh = ISO_TILE_HEIGHT / 2;
              drainageGraphics.poly([cx, cy + hh - 3, cx + hw - 3, cy, cx + hw, cy, cx, cy + hh]);
              drainageGraphics.fill({ color: 0x334155, alpha: 0.85 });

              // Driveway Crossover Slab (Connecting roads into compound entrances)
              if ((c + r) % 3 === 0) {
                drainageGraphics.poly([
                  cx + hw * 0.4,
                  cy + hh * 0.2,
                  cx + hw * 0.6,
                  cy + hh * 0.4,
                  cx + hw * 0.5,
                  cy + hh * 0.5,
                  cx + hw * 0.3,
                  cy + hh * 0.3,
                ]);
                drainageGraphics.fill({ color: 0xcfd6df });
              }

              // White Dashed Center Lane Marking
              if ((c + r) % 2 === 0) {
                roadGraphics.poly([cx - 3, cy - 1, cx + 3, cy + 1, cx + 2, cy + 2, cx - 4, cy]);
                roadGraphics.fill({ color: 0xf8fafc, alpha: 0.8 });
              }

              // Zebra Pedestrian Crossing at Junctions
              if (c % 4 === 0 && r % 4 === 0) {
                for (let k = -2; k <= 2; k++) {
                  roadGraphics.poly([
                    cx + k * 4 - 2,
                    cy - 4,
                    cx + k * 4 + 2,
                    cy - 2,
                    cx + k * 4,
                    cy + 4,
                    cx + k * 4 - 4,
                    cy + 2,
                  ]);
                  roadGraphics.fill({ color: 0xffffff, alpha: 0.9 });
                }
              }
            } else if (cellType === "w") {
              // OSUN RIVER CANAL
              drawDiamond(riverGraphics, cx, cy, 0x0891b2, 0.95, 0x0e7490, 1.2);
              // Water Shimmer Ripples
              riverGraphics.poly([cx - 8, cy, cx + 8, cy, cx + 4, cy + 1, cx - 4, cy + 1]);
              riverGraphics.fill({ color: 0x67e8f9, alpha: 0.55 });
            } else if (cellType === "p") {
              // COMPOUND / PLOT TILE (Sandy gravel with perimeter wall footing)
              drawDiamond(groundGraphics, cx, cy, 0xe2d9c8, 1, 0xc5b9a5, 0.6);
            } else {
              // NATURAL TERRAIN / GRASS TILE
              const toneVariation = (c * 17 + r * 31) % 4 === 0 ? 0xcbd5a1 : 0xa3b18a;
              drawDiamond(groundGraphics, cx, cy, toneVariation, 1, 0x89977c, 0.4);
            }
          }
        }

        worldContainer.addChild(groundGraphics);
        worldContainer.addChild(drainageGraphics);
        worldContainer.addChild(roadGraphics);
        worldContainer.addChild(riverGraphics);

        // ====================================================================
        // 4. DISTRICT OUTLINES & INTERACTIVE GROUND REGIONS
        // ====================================================================
        for (const district of townData.districts) {
          const area = district.gridArea;
          const p1 = gridToIso(area.x, area.z);
          const p2 = gridToIso(area.x + area.width, area.z);
          const p3 = gridToIso(area.x + area.width, area.z + area.depth);
          const p4 = gridToIso(area.x, area.z + area.depth);

          const districtZone = new PIXI.Graphics();
          districtZone.poly([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y]);
          districtZone.fill({ color: 0xffffff, alpha: 0.08 });
          districtZone.stroke({ width: 1.5, color: 0x94a3b8, alpha: 0.5 });
          districtZone.eventMode = "static";
          districtZone.cursor = "pointer";

          districtZone.on("pointertap", () => {
            if (!hasMoved) onSelectDistrict(district.id);
          });
          districtZone.on("pointerover", () => {
            districtZone.alpha = 1.4;
          });
          districtZone.on("pointerout", () => {
            districtZone.alpha = 1.0;
          });

          worldContainer.addChild(districtZone);
        }

        // ====================================================================
        // 5. NIGERIAN ARCHITECTURAL BUILDINGS & LANDMARK STRUCTURES
        // ====================================================================
        for (const bldg of townData.grid.buildings) {
          const { x: bx, y: by } = gridToIso(bldg.x + 0.5, bldg.z + 0.5);
          const buildingNode = new PIXI.Container();
          buildingNode.x = bx;
          buildingNode.y = by; // Origin is strictly at GROUND FOOTPRINT for accurate depth sorting
          buildingNode.eventMode = "static";

          const g = new PIXI.Graphics();
          const bType = bldg.buildingType?.toLowerCase() ?? "residential";

          if (bType === "bank") {
            // CEDAR BANK & MERIDIAN BANK (Corporate glass tower with ATM vestibule)
            const h = 56;
            const w = 32;
            const d = 16;
            // Concrete base & entrance steps
            g.poly([-w, 0, 0, d, w, 0, 0, -d]);
            g.fill({ color: 0x94a3b8 });
            // Left blue reflective glass facade
            g.poly([-w * 0.9, 0, 0, d * 0.9, 0, d * 0.9 - h, -w * 0.9, -h]);
            g.fill({ color: 0x0284c7 });
            // Right tinted glass facade
            g.poly([0, d * 0.9, w * 0.9, 0, w * 0.9, -h, 0, d * 0.9 - h]);
            g.fill({ color: 0x0369a1 });
            // Flat modern roof & corporate signage parapet
            g.poly([0, -d * 0.9 - h, w * 0.9, -h, 0, d * 0.9 - h, -w * 0.9, -h]);
            g.fill({ color: 0x0f172a });
            // Glass ATM vestibule entrance
            g.poly([-8, d * 0.9 - 14, 0, d * 0.9 - 10, 8, d * 0.9 - 14, 0, d * 0.9 - 18]);
            g.fill({ color: 0x38bdf8 });
          } else if (bType === "market") {
            // OJA-OBA MARKET STALL CLUSTER (Zinc roofs, cloth umbrellas, produce display)
            const h = 26;
            // Timber posts & stall counters
            g.poly([-24, 0, 0, 12, 24, 0, 0, -12]);
            g.fill({ color: 0x82705d });
            // Corrugated zinc roof with rusty orange tint
            g.poly([-26, -h, 0, 14 - h, 26, -h, 0, -14 - h]);
            g.fill({ color: 0xb77f68 });
            g.stroke({ width: 1, color: 0x9a3412 });
            // Colorful cloth sun umbrellas (Yellow, Emerald, Scarlet)
            g.circle(-12, -h - 6, 7);
            g.fill({ color: 0xeab308 });
            g.circle(12, -h - 4, 6.5);
            g.fill({ color: 0x10b981 });
            g.circle(0, -h - 10, 6);
            g.fill({ color: 0xef4444 });
          } else if (bType === "club") {
            // LANTERN CLUB & VIP LOUNGE (2-storey lounge, cocktail terrace, neon sign)
            const h = 48;
            g.poly([-26, 0, 0, 13, 26, 0, 0, -13]);
            g.fill({ color: 0x1e293b });
            // Left facade
            g.poly([-24, 0, 0, 12, 0, 12 - h, -24, -h]);
            g.fill({ color: 0x334155 });
            // Right facade
            g.poly([0, 12, 24, 0, 24, -h, 0, 12 - h]);
            g.fill({ color: 0x475569 });
            // Rooftop open terrace with glass railings
            g.poly([0, -12 - h, 24, -h, 0, 12 - h, -24, -h]);
            g.fill({ color: 0xf59e0b, alpha: 0.85 });
          } else if (bType === "sport") {
            // OSOGBO TOWNSHIP STADIUM / SPORTS GROUND (Green turf & spectator stands)
            g.poly([-36, 0, 0, 18, 36, 0, 0, -18]);
            g.fill({ color: 0x15803d });
            g.stroke({ width: 1.5, color: 0xffffff });
            // Center goal area
            g.poly([-10, 0, 0, 5, 10, 0, 0, -5]);
            g.stroke({ width: 1, color: 0xffffff });
            // Spectator bleachers
            g.poly([-34, -10, 0, 7, 0, 13, -34, -4]);
            g.fill({ color: 0x94a3b8 });
          } else if (bType === "civic" || bType === "school") {
            // CIVIC COURT & COMMUNITY SCHOOL (Colonial-modern structure with entrance colonnade)
            const h = 42;
            g.poly([-28, 0, 0, 14, 28, 0, 0, -14]);
            g.fill({ color: 0xe2e8f0 });
            g.poly([-26, 0, 0, 13, 0, 13 - h, -26, -h]);
            g.fill({ color: 0xcfd6df });
            g.poly([0, 13, 26, 0, 26, -h, 0, 13 - h]);
            g.fill({ color: 0xb8ad98 });
            // Pitched roof
            g.poly([0, -13 - h - 12, 28, -h, 0, 13 - h, -28, -h]);
            g.fill({ color: 0x74685e });
            // Entrance pillars
            for (let p = -2; p <= 2; p++) {
              g.rect(p * 7 - 1.5, 6 - 16, 3, 16);
              g.fill({ color: 0xffffff });
            }
          } else {
            // NIGERIAN RESIDENTIAL COMPOUND (Face-me-I-face-you, perimeter fence, GP water tank)
            const h = 36;
            // Compound perimeter wall
            g.poly([-28, 0, 0, 14, 28, 0, 0, -14]);
            g.stroke({ width: 1.5, color: 0xd4bea0 });
            // Main residence block
            g.poly([-18, 0, 0, 9, 0, 9 - h, -18, -h]);
            g.fill({ color: 0xd4bea0 });
            g.poly([0, 9, 18, 0, 18, -h, 0, 9 - h]);
            g.fill({ color: 0xb9b3a7 });
            // Pitched zinc roof
            g.poly([0, -9 - h - 8, 20, -h, 0, 9 - h, -20, -h]);
            g.fill({ color: 0xb77f68 });
            // Veranda front steps
            g.poly([-6, 11, 0, 14, 6, 11, 0, 8]);
            g.fill({ color: 0x94a3b8 });
            // Elevated Black GP Water Tank on steel trestle tower
            g.rect(14, -h - 10, 7, 8);
            g.fill({ color: 0x0f172a }); // Black plastic water tank
            g.rect(16, -h - 2, 3, 10);
            g.fill({ color: 0x64748b }); // Steel tower legs
            // Generator Shed (Small exterior acoustic enclosure)
            g.rect(-24, 2, 7, 6);
            g.fill({ color: 0x475569 });
          }

          buildingNode.addChild(g);
          worldContainer.addChild(buildingNode);
        }

        // ====================================================================
        // 6. MOVING NIGERIAN TRANSIT & PEDESTRIANS (WAYPOINTS ANIMATION)
        // ====================================================================
        // Danfo Bus (Yellow minibus with twin black stripes)
        const danfoNode = new PIXI.Container();
        const danfoG = new PIXI.Graphics();
        danfoG.rect(-10, -8, 20, 11);
        danfoG.fill({ color: 0xeab308 }); // Yellow bus body
        danfoG.rect(-10, -5, 20, 2);
        danfoG.fill({ color: 0x000000 }); // Iconic black stripe
        danfoG.rect(-10, -2, 20, 2);
        danfoG.fill({ color: 0x000000 });
        danfoG.rect(7, -8, 3, 5);
        danfoG.fill({ color: 0x38bdf8 }); // Windshield
        danfoNode.addChild(danfoG);
        worldContainer.addChild(danfoNode);

        // Keke Napep (Green tricycle)
        const kekeNode = new PIXI.Container();
        const kekeG = new PIXI.Graphics();
        kekeG.poly([-6, 0, 0, 4, 6, 0, 0, -4]);
        kekeG.fill({ color: 0x16a34a }); // Green body
        kekeG.circle(0, -6, 4);
        kekeG.fill({ color: 0xe2e8f0 }); // Canvas roof
        kekeNode.addChild(kekeG);
        worldContainer.addChild(kekeNode);

        // Okada Motorcycle with Rider
        const okadaNode = new PIXI.Container();
        const okadaG = new PIXI.Graphics();
        okadaG.rect(-5, -2, 10, 4);
        okadaG.fill({ color: 0xdc2626 });
        okadaG.circle(0, -7, 3);
        okadaG.fill({ color: 0x0f172a }); // Rider helmet
        okadaNode.addChild(okadaG);
        worldContainer.addChild(okadaNode);

        // ====================================================================
        // 7. COLLISION-FREE FLOATING LABELS (QUARTERS & LANDMARKS)
        // ====================================================================
        interface LabelItem {
          id: string;
          container: PIXI.Container;
          anchorX: number;
          anchorY: number;
          desiredX: number;
          desiredY: number;
          width: number;
          height: number;
        }

        const activeLabels: LabelItem[] = [];

        // 7A. DISTRICT FLOATING LABELS
        for (const district of townData.districts) {
          const area = district.gridArea;
          const center = gridToIso(area.x + area.width / 2, area.z + area.depth / 2);

          const labelContainer = new PIXI.Container();
          labelContainer.eventMode = "static";
          labelContainer.cursor = "pointer";

          const emoji = DISTRICT_EMOJIS[district.id] ?? "📍";
          const iconText = new PIXI.Text({
            text: emoji,
            style: { fontSize: 13 },
          });
          iconText.x = 8;
          iconText.y = 5;

          const titleText = new PIXI.Text({
            text: district.name,
            style: {
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              fontSize: 11.5,
              fontWeight: "700",
              fill: 0x1e293b,
              wordWrap: true,
              wordWrapWidth: 130, // Anti-truncation
            },
          });
          titleText.x = 28;
          titleText.y = 6;

          const totalWidth = Math.max(118, titleText.x + titleText.width + 10);
          const totalHeight = 28;

          const pillBg = new PIXI.Graphics();
          pillBg.roundRect(0, 2, totalWidth, totalHeight, 14);
          pillBg.fill({ color: 0x0f172a, alpha: 0.12 });
          pillBg.roundRect(0, 0, totalWidth, totalHeight, 14);
          pillBg.fill({ color: 0xffffff, alpha: 0.96 });
          pillBg.stroke({ width: 1.2, color: 0xcfd6df });

          labelContainer.addChild(pillBg);
          labelContainer.addChild(iconText);
          labelContainer.addChild(titleText);

          labelContainer.pivot.x = totalWidth / 2;
          labelContainer.pivot.y = totalHeight / 2;

          labelContainer.on("pointertap", () => {
            if (!hasMoved) onSelectDistrict(district.id);
          });

          uiOverlayContainer.addChild(labelContainer);

          activeLabels.push({
            id: district.id,
            container: labelContainer,
            anchorX: center.x,
            anchorY: center.y - 18,
            desiredX: 0,
            desiredY: 0,
            width: totalWidth,
            height: totalHeight,
          });
        }

        // 7B. LANDMARK INDIVIDUAL POI PINS (STATIC & NON-ANIMATED)
        for (const place of places) {
          const pt = gridToIso(place.grid.x, place.grid.z);
          const landmarkContainer = new PIXI.Container();
          landmarkContainer.eventMode = "static";
          landmarkContainer.cursor = "pointer";

          const emoji = LANDMARK_EMOJIS[place.id] ?? "📍";
          const iconText = new PIXI.Text({
            text: emoji,
            style: { fontSize: 12 },
          });
          iconText.x = 7;
          iconText.y = 5;

          const labelText = new PIXI.Text({
            text: place.label,
            style: {
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              fontSize: 11,
              fontWeight: "700",
              fill: 0x0f172a,
              wordWrap: true,
              wordWrapWidth: 120,
            },
          });
          labelText.x = 24;
          labelText.y = 6;

          const totalWidth = Math.max(90, labelText.x + labelText.width + 10);
          const totalHeight = 26;

          const card = new PIXI.Graphics();
          card.roundRect(0, 2, totalWidth, totalHeight, 13);
          card.fill({ color: 0x0f172a, alpha: 0.14 });
          card.roundRect(0, 0, totalWidth, totalHeight, 13);
          card.fill({ color: 0xffffff });
          card.stroke({ width: 1.5, color: 0x38bdf8 });

          landmarkContainer.addChild(card);
          landmarkContainer.addChild(iconText);
          landmarkContainer.addChild(labelText);

          landmarkContainer.pivot.x = totalWidth / 2;
          landmarkContainer.pivot.y = totalHeight / 2;

          landmarkContainer.on("pointertap", () => {
            if (!hasMoved) onSelectLandmark(place.id);
          });

          uiOverlayContainer.addChild(landmarkContainer);

          activeLabels.push({
            id: place.id,
            container: landmarkContainer,
            anchorX: pt.x,
            anchorY: pt.y - 48,
            desiredX: 0,
            desiredY: 0,
            width: totalWidth,
            height: totalHeight,
          });
        }

        // 7C. HOUSING PROPERTIES (IF PASSED)
        for (const prop of properties) {
          const { x: px, y: py } = gridToIso(prop.position[0], prop.position[2]);
          const propContainer = new PIXI.Container();
          propContainer.eventMode = "static";
          propContainer.cursor = "pointer";

          const statusText = prop.status === "owned" ? "🏠 Owned" : "🏡 Home";
          const text = new PIXI.Text({
            text: statusText,
            style: {
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 10,
              fontWeight: "700",
              fill: 0x047857,
            },
          });
          text.x = 8;
          text.y = 4;

          const pw = text.width + 16;
          const ph = 22;
          const pbg = new PIXI.Graphics();
          pbg.roundRect(0, 0, pw, ph, 11);
          pbg.fill({ color: 0xecfdf5 });
          pbg.stroke({ width: 1.2, color: 0x10b981 });

          propContainer.addChild(pbg);
          propContainer.addChild(text);
          propContainer.pivot.x = pw / 2;
          propContainer.pivot.y = ph / 2;

          propContainer.on("pointertap", () => {
            if (!hasMoved) onSelectProperty?.(prop);
          });

          uiOverlayContainer.addChild(propContainer);

          activeLabels.push({
            id: prop.id,
            container: propContainer,
            anchorX: px,
            anchorY: py - 36,
            desiredX: 0,
            desiredY: 0,
            width: pw,
            height: ph,
          });
        }

        // ====================================================================
        // 8. TICKER LOOP: DEPTH SORTING & AABB ANTI-COLLISION RELAXATION
        // ====================================================================
        let elapsed = 0;
        app.ticker.add((ticker) => {
          if (!app) return;
          const delta = ticker.deltaTime / 60;
          elapsed += delta;

          // Continuous Isometric Depth Sorting along Y axis
          worldContainer.children.sort((a, b) => a.y - b.y);

          // Animate transit along road circuits
          const danfoT = (elapsed * 0.18) % 1;
          const danfoPos = gridToIso(2 + danfoT * 18, 5);
          danfoNode.x = danfoPos.x;
          danfoNode.y = danfoPos.y;

          const kekeT = (elapsed * 0.22) % 1;
          const kekePos = gridToIso(10, 2 + kekeT * 12);
          kekeNode.x = kekePos.x;
          kekeNode.y = kekePos.y;

          const okadaT = (elapsed * 0.28) % 1;
          const okadaPos = gridToIso(14 - okadaT * 12, 10);
          okadaNode.x = okadaPos.x;
          okadaNode.y = okadaPos.y;

          // Update desired screen-space positions for floating labels
          for (const node of activeLabels) {
            node.desiredX = node.anchorX;
            node.desiredY = node.anchorY;
            node.container.x = node.desiredX;
            node.container.y = node.desiredY;
          }

          // Multi-Pass 2D AABB Anti-Collision Relaxation Solver
          const minGap = 8;
          for (let iter = 0; iter < 4; iter++) {
            activeLabels.sort((a, b) => a.container.y - b.container.y);

            for (let i = 0; i < activeLabels.length; i++) {
              for (let j = i + 1; j < activeLabels.length; j++) {
                const a = activeLabels[i]!;
                const b = activeLabels[j]!;

                const boxA: BoundingBox = {
                  x: a.container.x - a.container.pivot.x,
                  y: a.container.y - a.container.pivot.y,
                  width: a.width,
                  height: a.height,
                };

                const boxB: BoundingBox = {
                  x: b.container.x - b.container.pivot.x,
                  y: b.container.y - b.container.pivot.y,
                  width: b.width,
                  height: b.height,
                };

                const isOverlapping =
                  boxA.x < boxB.x + boxB.width + minGap &&
                  boxA.x + boxA.width + minGap > boxB.x &&
                  boxA.y < boxB.y + boxB.height + minGap &&
                  boxA.y + boxA.height + minGap > boxB.y;

                if (isOverlapping) {
                  const overlapY = boxA.y + boxA.height + minGap - boxB.y;
                  a.container.y -= overlapY * 0.45;
                  b.container.y += overlapY * 0.55;
                }
              }
            }
          }
        });

        onReady?.();
      } catch (err) {
        console.warn("[PixiTownMap] WebGL/Pixi initialization error:", err);
        setInitError(true);
        onUnavailable?.();
      }
    }

    void initPixiEngine();

    return () => {
      isDisposed = true;
      if (onPointerMove) window.removeEventListener("pointermove", onPointerMove);
      if (onPointerUp) window.removeEventListener("pointerup", onPointerUp);
      if (hostRef.current) {
        if (onPointerDown) hostRef.current.removeEventListener("pointerdown", onPointerDown);
        if (onWheel) hostRef.current.removeEventListener("wheel", onWheel);
      }
      if (app) {
        // If init failed (for example no WebGL), the app is only partly built and destroy
        // throws. Teardown must not crash unmount, so ignore that case.
        try {
          app.destroy(true, { children: true });
        } catch {
          /* the app never finished starting, so there is nothing to tear down */
        }
      }
    };
  }, [
    places,
    properties,
    onSelectDistrict,
    onSelectLandmark,
    onSelectProperty,
    onReady,
    onUnavailable,
  ]);

  if (initError) return null;

  return (
    <div
      ref={hostRef}
      className="town-map-pixi-host"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: "none",
        cursor: "grab",
      }}
    />
  );
}
