import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import townData from "@/data/osogbo-town.json";
import { projectTownCell } from "@/components/map/town-map-geometry";
import type { MapPlayerLocation, MapProperty } from "@/components/map/MapCanvas";

export interface PixiTownMapProps {
  onSelectDistrict: (id: string) => void;
  onSelectLandmark: (id: string) => void;
  playerLocation?: MapPlayerLocation | null;
  properties?: readonly MapProperty[];
  onSelectProperty?: (property: MapProperty) => void;
  onReady?: () => void;
  onUnavailable?: () => void;
}

const DISTRICT_EMOJIS: Record<string, string> = {
  "market-quarter": "🛍️",
  "civic-quarter": "🏛️",
  "commerce-quarter": "💼",
  "garden-quarter": "🌳",
  "learning-quarter": "📚",
  "transit-quarter": "🚌",
  "river-quarter": "🌊",
  "south-quarter": "🏘️",
};

interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function PixiTownMapSurface({
  onSelectDistrict,
  onSelectLandmark: _onSelectLandmark,
  onReady,
  onUnavailable,
}: PixiTownMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !hostRef.current) {
      onUnavailable?.();
      return;
    }

    let isDisposed = false;
    let app: PIXI.Application | null = null;

    async function initPixi() {
      try {
        const host = hostRef.current;
        if (!host) return;

        app = new PIXI.Application();
        await app.init({
          resizeTo: host,
          backgroundColor: 0xdce7dc,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
          antialias: true,
        });

        if (isDisposed) {
          app.destroy(true, { children: true });
          return;
        }

        host.appendChild(app.canvas);

        // 1. LAYER SEPARATION
        // worldContainer: holds ground polygons, buildings, and ground objects (depth sorted)
        const worldContainer = new PIXI.Container();
        // uiOverlayContainer: floats in screen-space above all 2.5D buildings
        const uiOverlayContainer = new PIXI.Container();

        app.stage.addChild(worldContainer);
        app.stage.addChild(uiOverlayContainer);

        // Center map camera to viewport
        const centerWorld = () => {
          if (!app) return;
          worldContainer.x = app.screen.width / 2;
          worldContainer.y = app.screen.height / 3;
        };
        centerWorld();

        window.addEventListener("resize", centerWorld);

        // 2. DRAW GROUND TILES
        const groundGraphics = new PIXI.Graphics();
        for (let r = 0; r < townData.grid.rows.length; r++) {
          const row = townData.grid.rows[r]!;
          for (let c = 0; c < row.length; c++) {
            const pt = projectTownCell(c, r);
            const w = 48;
            const h = 24;
            groundGraphics.poly([
              pt.x - 600,
              pt.y - 400 - h / 2,
              pt.x - 600 + w / 2,
              pt.y - 400,
              pt.x - 600,
              pt.y - 400 + h / 2,
              pt.x - 600 - w / 2,
              pt.y - 400,
            ]);
            groundGraphics.fill({ color: 0xd2c7b5, alpha: 0.4 });
            groundGraphics.stroke({ width: 1, color: 0xbaa992, alpha: 0.3 });
          }
        }
        worldContainer.addChild(groundGraphics);

        // 3. QUARTER STRUCTURE CONTAINERS (Anchored at Ground Footprint)
        const labelNodes: {
          container: PIXI.Container;
          pill: PIXI.Graphics;
          targetDistrict: (typeof townData.districts)[number];
          anchorX: number;
          anchorY: number;
          desiredX: number;
          desiredY: number;
          width: number;
          height: number;
        }[] = [];

        for (const district of townData.districts) {
          const area = district.gridArea;
          const center = projectTownCell(area.x + area.width / 2, area.z + area.depth / 2);
          const worldX = center.x - 600;
          const worldY = center.y - 400;

          // Quarter World Node: Origin is strictly at GROUND FOOTPRINT (worldX, worldY)
          const quarterNode = new PIXI.Container();
          quarterNode.x = worldX;
          quarterNode.y = worldY;
          quarterNode.eventMode = "static";
          quarterNode.cursor = "pointer";

          // Ground perimeter diamond
          const groundPlot = new PIXI.Graphics();
          const hw = 52;
          const hh = 26;
          groundPlot.poly([-hw, 0, 0, -hh, hw, 0, 0, hh]);
          groundPlot.fill({ color: 0xffffff, alpha: 0.15 });
          groundPlot.stroke({ width: 1.5, color: 0x94a3b8, alpha: 0.6 });
          quarterNode.addChild(groundPlot);

          // 2.5D Extruded Building Geometry (Extruded UPWARD into negative Y)
          const bldg = new PIXI.Graphics();
          const bldgH = 44;
          // Left facade
          bldg.poly([-22, 0, 0, 11, 0, 11 - bldgH, -22, -bldgH]);
          bldg.fill({ color: 0xc27845 });
          // Right facade
          bldg.poly([0, 11, 22, 0, 22, -bldgH, 0, 11 - bldgH]);
          bldg.fill({ color: 0xd98d5a });
          // Roof
          bldg.poly([0, -11 - bldgH, 22, -bldgH, 0, 11 - bldgH, -22, -bldgH]);
          bldg.fill({ color: 0x3b82f6 });
          bldg.stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
          quarterNode.addChild(bldg);

          quarterNode.on("pointertap", () => onSelectDistrict(district.id));
          quarterNode.on("pointerover", () => {
            bldg.tint = 0xffe082;
          });
          quarterNode.on("pointerout", () => {
            bldg.tint = 0xffffff;
          });

          worldContainer.addChild(quarterNode);

          // 4. FLOATING LABEL IN SCREEN-SPACE UI CONTAINER
          const labelContainer = new PIXI.Container();
          labelContainer.eventMode = "static";
          labelContainer.cursor = "pointer";

          const icon = DISTRICT_EMOJIS[district.id] ?? "📍";
          const iconText = new PIXI.Text({
            text: icon,
            style: { fontSize: 13 },
          });
          iconText.x = 8;
          iconText.y = 5;

          const titleText = new PIXI.Text({
            text: district.name,
            style: {
              fontFamily: "Inter, system-ui, sans-serif",
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
          // Drop shadow
          pillBg.roundRect(0, 2, totalWidth, totalHeight, 14);
          pillBg.fill({ color: 0x0f172a, alpha: 0.12 });
          // Pill card
          pillBg.roundRect(0, 0, totalWidth, totalHeight, 14);
          pillBg.fill({ color: 0xffffff, alpha: 0.96 });
          pillBg.stroke({ width: 1.2, color: 0xcfd6df });

          labelContainer.addChild(pillBg);
          labelContainer.addChild(iconText);
          labelContainer.addChild(titleText);

          labelContainer.pivot.x = totalWidth / 2;
          labelContainer.pivot.y = totalHeight / 2;

          labelContainer.on("pointertap", () => onSelectDistrict(district.id));

          uiOverlayContainer.addChild(labelContainer);

          labelNodes.push({
            container: labelContainer,
            pill: pillBg,
            targetDistrict: district,
            anchorX: worldX,
            anchorY: worldY - bldgH - 16,
            desiredX: 0,
            desiredY: 0,
            width: totalWidth,
            height: totalHeight,
          });
        }

        // 5. TICKER LOOP: DEPTH SORTING & AABB ANTI-COLLISION RESOLUTION
        app.ticker.add(() => {
          if (!app) return;

          // Continuous Isometric Depth Sorting
          worldContainer.children.sort((a, b) => a.y - b.y);

          // Update desired screen-space positions
          for (const node of labelNodes) {
            const globalPos = worldContainer.toGlobal(new PIXI.Point(node.anchorX, node.anchorY));
            node.desiredX = globalPos.x;
            node.desiredY = globalPos.y;
            node.container.x = node.desiredX;
            node.container.y = node.desiredY;
          }

          // Iterative 2D AABB Anti-Collision Relaxation
          const minGap = 8;
          const pad = 24;
          const sw = app.screen.width;
          const sh = app.screen.height;

          for (let iter = 0; iter < 4; iter++) {
            labelNodes.sort((a, b) => a.container.y - b.container.y);

            for (let i = 0; i < labelNodes.length; i++) {
              for (let j = i + 1; j < labelNodes.length; j++) {
                const a = labelNodes[i]!;
                const b = labelNodes[j]!;

                const boxA: AABB = {
                  x: a.container.x - a.container.pivot.x,
                  y: a.container.y - a.container.pivot.y,
                  width: a.width,
                  height: a.height,
                };

                const boxB: AABB = {
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

            // Viewport bounds clamping pass
            for (const node of labelNodes) {
              const halfW = node.width / 2;
              const halfH = node.height / 2;
              if (node.container.x - halfW < pad) node.container.x = pad + halfW;
              if (node.container.x + halfW > sw - pad) node.container.x = sw - pad - halfW;
              if (node.container.y - halfH < pad) node.container.y = pad + halfH;
              if (node.container.y + halfH > sh - pad) node.container.y = sh - pad - halfH;
            }
          }
        });

        onReady?.();
      } catch (err) {
        console.warn("[PixiTownMap] WebGL/Pixi initialisation error:", err);
        setInitError(true);
        onUnavailable?.();
      }
    }

    void initPixi();

    return () => {
      isDisposed = true;
      if (app) {
        app.destroy(true, { children: true });
      }
    };
  }, [onSelectDistrict, onReady, onUnavailable]);

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
      }}
    />
  );
}
