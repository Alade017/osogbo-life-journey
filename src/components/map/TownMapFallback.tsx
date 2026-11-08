import { useMemo } from "react";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import townData from "@/data/osogbo-town.json";
import {
  pointsAttribute,
  projectTownCell,
  scenePositionToGridCell,
  townDiamondPoints,
} from "@/components/map/town-map-geometry";
import type {
  MapBillboardMarker,
  MapPlayerLocation,
  MapProperty,
} from "@/components/map/MapCanvas";

type Props = {
  places: readonly (typeof townData.landmarks)[number][];
  properties: readonly MapProperty[] | undefined;
  playerLocation: MapPlayerLocation | null | undefined;
  billboardMarkers: readonly MapBillboardMarker[];
  onSelectLandmark: (id: string) => void;
  onSelectDistrict: (id: string) => void;
  onSelectBillboard: ((campaignId: string) => void) | undefined;
  onSelectProperty?: (property: MapProperty) => void;
  eventChips: readonly { id: string; label: string; x: number; y: number }[];
  onSelectEvent?: (landmarkId: string) => void;
};

const cellColors: Record<string, string> = {
  g: WORLD_PALETTE.ground,
  r: WORLD_PALETTE.road,
  w: WORLD_PALETTE.slate,
  p: WORLD_PALETTE.wall,
};

const districtIcons: Record<string, string> = {
  "market-quarter": "🛍️",
  "civic-quarter": "🏛️",
  "commerce-quarter": "💼",
  "garden-quarter": "🌳",
  "learning-quarter": "📚",
  "transit-quarter": "🚌",
  "river-quarter": "🌊",
  "south-quarter": "🏘️",
};

interface DistrictLabelLayout {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  icon: string;
}

export function TownMapFallback({
  places,
  properties,
  playerLocation,
  billboardMarkers,
  onSelectLandmark,
  onSelectDistrict,
  onSelectBillboard,
  onSelectProperty,
  eventChips,
  onSelectEvent,
}: Props) {
  const billboardByLandmark = useMemo(
    () => new Map(billboardMarkers.map((b) => [b.landmarkId, b])),
    [billboardMarkers],
  );

  const playerPoint = useMemo(
    () => (playerLocation ? projectTownCell(playerLocation.x, playerLocation.y) : null),
    [playerLocation],
  );

  // 1. ISOMETRIC LAYER DEPTH SORTING FOR WORLD OBJECTS
  const sortedWorldElements = useMemo(() => {
    const buildings = townData.grid.buildings.map((building) => {
      const point = projectTownCell(building.x + 0.5, building.z + 0.5);
      return {
        type: "building" as const,
        id: `building-${building.x}-${building.z}`,
        x: point.x,
        y: point.y,
      };
    });

    const propertyElements = (properties ?? []).map((property) => {
      const cellCoord = scenePositionToGridCell(property.position);
      const point = projectTownCell(cellCoord.col, cellCoord.row);
      return {
        type: "property" as const,
        id: property.id,
        x: point.x,
        y: point.y,
        property,
      };
    });

    // Sort ascending by Y so distant objects render first and foreground overlaps correctly
    return [...buildings, ...propertyElements].sort((a, b) => a.y - b.y);
  }, [properties]);

  // 2. COLLISION-FREE FLOATING LABEL SYSTEM (2D AABB RELAXATION SOLVER)
  const districtLabels = useMemo<DistrictLabelLayout[]>(() => {
    const items = townData.districts.map((district) => {
      const area = district.gridArea;
      const center = projectTownCell(area.x + area.width / 2, area.z + area.depth / 2);
      const icon = districtIcons[district.id] ?? "📍";
      // Dynamic width calculation ensuring generous room for full name & icon
      const width = Math.max(118, Math.min(160, district.name.length * 8.2 + 38));
      const height = 28;

      return {
        id: district.id,
        name: district.name,
        x: center.x,
        y: center.y - 12,
        width,
        height,
        icon,
      };
    });

    const minGap = 8;
    const padding = 28; // Strict margin from SVG viewport bounds

    // Multi-pass relaxation loop
    for (let iter = 0; iter < 6; iter++) {
      items.sort((a, b) => a.y - b.y);

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i]!;
          const b = items[j]!;

          const aLeft = a.x - a.width / 2;
          const aRight = a.x + a.width / 2;
          const aTop = a.y - a.height / 2;
          const aBottom = a.y + a.height / 2;

          const bLeft = b.x - b.width / 2;
          const bRight = b.x + b.width / 2;
          const bTop = b.y - b.height / 2;
          const bBottom = b.y + b.height / 2;

          const overlapX = Math.min(aRight + minGap, bRight + minGap) - Math.max(aLeft, bLeft);
          const overlapY = Math.min(aBottom + minGap, bBottom + minGap) - Math.max(aTop, bTop);

          if (overlapX > 0 && overlapY > 0) {
            a.y -= overlapY * 0.5;
            b.y += overlapY * 0.5;
          }
        }
      }

      // Viewport margin clamp pass to entirely prevent off-screen truncation (e.g. "...ter")
      for (const item of items) {
        const halfW = item.width / 2;
        const halfH = item.height / 2;
        if (item.x - halfW < padding) item.x = padding + halfW;
        if (item.x + halfW > 1200 - padding) item.x = 1200 - padding - halfW;
        if (item.y - halfH < padding) item.y = padding + halfH;
        if (item.y + halfH > 800 - padding) item.y = 800 - padding - halfH;
      }
    }

    return items;
  }, []);

  return (
    <svg
      className="town-map-svg-fallback"
      viewBox="0 0 1200 800"
      role="img"
      aria-label="Illustrated town map fallback"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* LAYER 1: BASE TERRAIN TILES */}
      <rect width="1200" height="800" fill={WORLD_PALETTE.ground} />
      {townData.grid.rows.map((row, z) =>
        [...row].map((cell, x) => (
          <polygon
            key={`tile-${x}-${z}`}
            points={pointsAttribute(townDiamondPoints(x, z))}
            fill={cellColors[cell] ?? cellColors["g"]!}
          />
        )),
      )}

      {/* LAYER 2: DISTRICT GROUND POLYGONS (Anchored to ground footprint) */}
      {townData.districts.map((district) => {
        const area = district.gridArea;
        const points = [
          [projectTownCell(area.x, area.z).x, projectTownCell(area.x, area.z).y],
          [
            projectTownCell(area.x + area.width, area.z).x,
            projectTownCell(area.x + area.width, area.z).y,
          ],
          [
            projectTownCell(area.x + area.width, area.z + area.depth).x,
            projectTownCell(area.x + area.width, area.z + area.depth).y,
          ],
          [
            projectTownCell(area.x, area.z + area.depth).x,
            projectTownCell(area.x, area.z + area.depth).y,
          ],
        ] as [number, number][];

        return (
          <g
            key={`district-zone-${district.id}`}
            className="town-map-svg-district"
            role="button"
            tabIndex={0}
            aria-label={`Open ${district.name} district`}
            onClick={() => onSelectDistrict(district.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectDistrict(district.id);
              }
            }}
          >
            <polygon
              points={pointsAttribute(points)}
              fill={WORLD_PALETTE.linen}
              fillOpacity="0.12"
              stroke={WORLD_PALETTE.wall}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          </g>
        );
      })}

      {/* LAYER 3: DEPTH-SORTED ISOMETRIC WORLD ELEMENTS */}
      {sortedWorldElements.map((elem) => {
        if (elem.type === "building") {
          return (
            <path
              key={elem.id}
              d={`M${elem.x - 8} ${elem.y - 7} l8 -5 8 5 v10 h-16z`}
              fill={WORLD_PALETTE.clay}
              aria-hidden="true"
            />
          );
        }

        const property = elem.property;
        return (
          <g
            key={elem.id}
            className="town-map-svg-home"
            role="button"
            tabIndex={0}
            aria-label={"Open " + (property.label ?? "home") + ": " + property.status.replace("_", " ")}
            onClick={() => onSelectProperty?.(property)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectProperty?.(property);
              }
            }}
          >
            <circle cx={elem.x} cy={elem.y} r="9" />
            <text x={elem.x + 12} y={elem.y + 4}>
              {property.label ?? "Home"}
            </text>
          </g>
        );
      })}

      {/* LAYER 4: PLACES & LANDMARK MARKERS */}
      {places.map((place) => {
        const point = projectTownCell(place.grid.x, place.grid.z);
        return (
          <g
            key={place.id}
            className="town-map-svg-place"
            role="button"
            tabIndex={0}
            aria-label={`Open ${place.label}, ${place.category}`}
            onClick={() => onSelectLandmark(place.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectLandmark(place.id);
              }
            }}
          >
            <circle cx={point.x} cy={point.y - 10} r="13" />
            <text x={point.x} y={point.y + 13} textAnchor="middle">
              {place.label}
            </text>
          </g>
        );
      })}

      {/* LAYER 5: LIVE EVENTS & BILLBOARDS */}
      {eventChips.map((event) => {
        const point = projectTownCell(event.x, event.y);
        return (
          <g
            key={event.id}
            className="town-map-svg-event"
            role="button"
            tabIndex={0}
            aria-label={"Open live event: " + event.label}
            onClick={() => onSelectEvent?.(event.id)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                keyEvent.preventDefault();
                onSelectEvent?.(event.id);
              }
            }}
          >
            <circle cx={point.x + 20} cy={point.y - 30} r="11" />
            <text x={point.x + 20} y={point.y - 26} textAnchor="middle">
              !
            </text>
          </g>
        );
      })}

      {places.flatMap((place) => {
        const billboard = billboardByLandmark.get(place.id);
        if (!billboard) return [];
        const point = projectTownCell(place.grid.x, place.grid.z);
        return [
          <g
            key={billboard.campaignId}
            className="town-map-svg-billboard"
            role="button"
            tabIndex={0}
            aria-label={`Billboard for ${billboard.advertiserName}`}
            onClick={() => onSelectBillboard?.(billboard.campaignId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectBillboard?.(billboard.campaignId);
              }
            }}
          >
            <circle cx={point.x + 17} cy={point.y - 22} r="8" />
            <text x={point.x + 17} y={point.y - 19} textAnchor="middle">
              {billboard.count}
            </text>
          </g>,
        ];
      })}

      {/* LAYER 6: FLOATING UI OVERLAY - COLLISION-FREE DISTRICT LABELS */}
      <g className="town-map-svg-labels-layer">
        {districtLabels.map((item) => {
          const pillX = item.x - item.width / 2;
          const pillY = item.y - item.height / 2;

          return (
            <g
              key={`label-pill-${item.id}`}
              className="town-map-svg-district-pill"
              role="button"
              tabIndex={0}
              aria-label={`Open ${item.name} district`}
              onClick={() => onSelectDistrict(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectDistrict(item.id);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              {/* Drop Shadow */}
              <rect
                x={pillX}
                y={pillY + 2}
                width={item.width}
                height={item.height}
                rx="14"
                fill="rgba(15, 23, 42, 0.12)"
              />
              {/* Pill Card */}
              <rect
                x={pillX}
                y={pillY}
                width={item.width}
                height={item.height}
                rx="14"
                fill="#ffffff"
                stroke="#cbd5e1"
                strokeWidth="1.2"
              />
              {/* Category Emoji */}
              <text
                x={pillX + 10}
                y={item.y + 4}
                fontSize="13"
                dominantBaseline="central"
              >
                {item.icon}
              </text>
              {/* Full Title (Collision-Free & Never Truncated) */}
              <text
                x={pillX + 27}
                y={item.y + 4}
                fontSize="11.5"
                fontWeight="700"
                fill="#1e293b"
                dominantBaseline="central"
              >
                {item.name}
              </text>
            </g>
          );
        })}
      </g>

      {/* PLAYER LOCATION MARKER */}
      {playerPoint && (
        <g className="town-map-svg-player">
          <circle cx={playerPoint.x} cy={playerPoint.y} r="12" />
          <text x={playerPoint.x} y={playerPoint.y + 4} textAnchor="middle">
            ●
          </text>
        </g>
      )}
    </svg>
  );
}
