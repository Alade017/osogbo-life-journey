import { WORLD_PALETTE } from "@/components/3d/world-theme";
import townData from "@/data/osogbo-town.json";
import {
  pointsAttribute,
  projectTownCell,
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
};

const cellColors: Record<string, string> = {
  g: WORLD_PALETTE.ground,
  r: WORLD_PALETTE.road,
  w: WORLD_PALETTE.slate,
  p: WORLD_PALETTE.wall,
};

export function TownMapFallback({
  places,
  properties,
  playerLocation,
  billboardMarkers,
  onSelectLandmark,
  onSelectDistrict,
  onSelectBillboard,
}: Props) {
  const placeByLandmark = new Map(places.map((place) => [place.id, place]));
  const billboardByLandmark = new Map(
    billboardMarkers.map((billboard) => [billboard.landmarkId, billboard]),
  );
  const playerPoint = playerLocation ? projectTownCell(playerLocation.x, playerLocation.y) : null;

  return (
    <svg
      className="town-map-svg-fallback"
      viewBox="0 0 1200 800"
      role="img"
      aria-label="Illustrated town map fallback"
      preserveAspectRatio="xMidYMid meet"
    >
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
        const center = projectTownCell(area.x + area.width / 2, area.z + area.depth / 2);
        return (
          <g
            key={district.id}
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
              fillOpacity="0.08"
            />
            <text x={center.x} y={center.y} textAnchor="middle">
              {district.name}
            </text>
          </g>
        );
      })}
      {townData.grid.buildings.map((building) => {
        const point = projectTownCell(building.x + 0.5, building.z + 0.5);
        return (
          <path
            key={`building-${building.x}-${building.z}`}
            d={`M${point.x - 8} ${point.y - 7} l8 -5 8 5 v10 h-16z`}
            fill={WORLD_PALETTE.clay}
            aria-hidden="true"
          />
        );
      })}
      {properties?.map((property) => {
        const point = projectTownCell(
          property.position[0] / 2 + 6.5,
          property.position[2] / 2 + 4.5,
        );
        return (
          <g key={property.id} className="town-map-svg-home">
            <circle cx={point.x} cy={point.y} r="9" />
            <text x={point.x + 12} y={point.y + 4}>
              {property.label ?? "Home"}
            </text>
          </g>
        );
      })}
      {places.map((place) => {
        const point = projectTownCell(place.grid.x, place.grid.z);
        const billboard = billboardByLandmark.get(place.id);
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
