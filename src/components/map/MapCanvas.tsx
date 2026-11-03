import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import townData from "@/data/osogbo-town.json";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { TownMapFallback } from "@/components/map/TownMapFallback";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";

const R3FTownSurface = lazy(() =>
  import("./R3FTownSurface").then((module) => ({ default: module.R3FTownSurface })),
);

export type MapFilter =
  | "market"
  | "transport"
  | "school"
  | "health"
  | "worship"
  | "junction"
  | "sport"
  | "food"
  | "services"
  | "jobs"
  | "all";
export type MapSearchTarget = string | { id: string; kind?: "district" | "landmark" };
export type MapPlayerLocation = {
  x: number;
  y: number;
  label?: string;
  activity?: string;
  markerType?: "player" | "stall" | "job";
};
export type MapEventChip = { id: string; label: string; x: number; y: number };
export type MapBillboardMarker = {
  campaignId: string;
  landmarkId: string;
  advertiserName: string;
  title?: string;
  imageUrl?: string | null;
  count: number;
};

/** Display-only property input. Ownership, rent, and status remain server/game-state owned. */
export type MapProperty = {
  id: string;
  label?: string;
  type: "compound" | "flat" | "shophouse";
  tier: 1 | 2 | 3;
  status: "owned" | "current" | "rent_due" | "overdue" | "vacant";
  position: [number, number, number];
  rotation?: number;
  ownerName?: string;
};

export interface MapCanvasProps {
  onSelectDistrict: (id: string) => void;
  onSelectLandmark: (id: string) => void;
  activeFilter?: MapFilter;
  searchTarget?: MapSearchTarget | null;
  playerLocation?: MapPlayerLocation | null;
  eventChips?: MapEventChip[];
  jobLandmarkIds?: string[];
  billboardMarkers?: MapBillboardMarker[];
  onSelectBillboard?: (campaignId: string) => void;
  availableLandmarkIds?: readonly string[];
  /** Pass undefined while the existing property source is loading. */
  properties?: readonly MapProperty[] | undefined;
}

const propertyStatusText: Record<MapProperty["status"], string> = {
  owned: "Owned",
  current: "Your home",
  rent_due: "Rent due",
  overdue: "Rent overdue",
  vacant: "Vacant",
};

const filterCategories: Partial<Record<MapFilter, readonly string[]>> = {
  jobs: ["services", "food", "market", "transport"],
};

export function houseBadgeText(property: MapProperty) {
  if (property.status === "owned" && property.ownerName) return property.ownerName;
  return propertyStatusText[property.status];
}

export function MapCanvas({
  onSelectDistrict,
  onSelectLandmark,
  activeFilter = "all",
  searchTarget,
  playerLocation,
  eventChips: _eventChips = [],
  jobLandmarkIds = [],
  billboardMarkers = [],
  availableLandmarkIds,
  onSelectBillboard,
  properties,
}: MapCanvasProps) {
  const [rendererState, setRendererState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    if (!searchTarget) return;
    const id = typeof searchTarget === "string" ? searchTarget : searchTarget.id;
    if (townData.landmarks.some((landmark) => landmark.id === id)) {
      onSelectLandmark(id);
      return;
    }
    if (townData.districts.some((district) => district.id === id)) onSelectDistrict(id);
  }, [onSelectDistrict, onSelectLandmark, searchTarget]);

  const availablePlaces = useMemo(
    () =>
      townData.landmarks.filter(
        (place) =>
          (availableLandmarkIds === undefined || availableLandmarkIds.includes(place.id)) &&
          (activeFilter === "all" ||
            (activeFilter === "jobs"
              ? jobLandmarkIds.includes(place.id)
              : (filterCategories[activeFilter] ?? [activeFilter]).includes(place.category))),
      ),
    [activeFilter, availableLandmarkIds, jobLandmarkIds],
  );

  const handleReady = useCallback(() => setRendererState("ready"), []);
  const handleUnavailable = useCallback(() => setRendererState("fallback"), []);

  return (
    <section
      className="map-canvas town-map-canvas"
      style={{ background: WORLD_PALETTE.ground }}
      aria-label="Interactive isometric town map"
    >
      {rendererState !== "ready" && (
        <TownMapFallback
          places={availablePlaces}
          properties={properties}
          playerLocation={playerLocation}
          billboardMarkers={billboardMarkers}
          onSelectLandmark={onSelectLandmark}
          onSelectDistrict={onSelectDistrict}
          onSelectBillboard={onSelectBillboard}
        />
      )}
      <Suspense fallback={null}>
        <R3FTownSurface
          places={availablePlaces}
          properties={properties}
          playerLocation={playerLocation}
          billboardMarkers={billboardMarkers}
          onSelectLandmark={onSelectLandmark}
          onSelectDistrict={onSelectDistrict}
          onSelectBillboard={onSelectBillboard}
          onReady={handleReady}
          onUnavailable={handleUnavailable}
        />
      </Suspense>
      {rendererState === "loading" && (
        <div className="town-map-renderer-status">
          <WorldLoadingIndicator
            title="Opening the map"
            detail="Starting the interactive town map…"
          />
        </div>
      )}
      {rendererState === "fallback" && (
        <p className="town-map-renderer-status" role="status">
          Interactive rendering is unavailable. Showing the accessible town map.
        </p>
      )}
      <ul className="town-map-accessible-list" aria-label="Places on the map">
        {properties?.map((property) => (
          <li key={property.id}>
            {property.label ?? "House"}, {houseBadgeText(property)}
          </li>
        ))}
        {availablePlaces.map((place) => (
          <li key={place.id}>
            <button type="button" onClick={() => onSelectLandmark(place.id)}>
              {place.label}, {place.category}
            </button>
          </li>
        ))}
        {billboardMarkers.map((billboard) => (
          <li key={billboard.campaignId}>
            <button type="button" onClick={() => onSelectBillboard?.(billboard.campaignId)}>
              Billboard for {billboard.advertiserName}
            </button>
          </li>
        ))}
      </ul>
      <ul className="town-map-accessible-list" aria-label="Districts on the map">
        {townData.districts.map((district) => (
          <li key={district.id}>
            <button type="button" onClick={() => onSelectDistrict(district.id)}>
              {district.name} district
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
