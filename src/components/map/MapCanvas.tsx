import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import townData from "@/data/osogbo-town.json";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";

const TownSurface3D = lazy(() =>
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
  onSelectProperty?: (property: MapProperty) => void;
  onSelectEvent?: (landmarkId: string) => void;
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

function houseBadgeText(property: MapProperty) {
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
  onSelectProperty,
  onSelectEvent,
}: MapCanvasProps) {
  const [rendererState, setRendererState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

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
  // Every landmark not yet open to the player is shown as a locked pin, whatever the filter.
  const lockedPlaces = useMemo(
    () =>
      availableLandmarkIds === undefined
        ? []
        : townData.landmarks.filter(
            (place) =>
              !availableLandmarkIds.includes(place.id) && place.mapObjectType !== "junction",
          ),
    [availableLandmarkIds],
  );

  const handleReady = useCallback(() => setRendererState("ready"), []);
  const handleUnavailable = useCallback(() => setRendererState("unavailable"), []);

  return (
    <section
      className="map-canvas town-map-canvas"
      style={{ background: WORLD_PALETTE.ground }}
      aria-label="Interactive 3D town map with open camera exploration"
    >
      <Suspense fallback={null}>
        {rendererState !== "unavailable" && (
          <TownSurface3D
            places={availablePlaces}
            lockedPlaces={lockedPlaces}
            properties={properties}
            playerLocation={playerLocation}
            billboardMarkers={billboardMarkers}
            searchTarget={searchTarget ?? null}
            onSelectLandmark={onSelectLandmark}
            onSelectDistrict={onSelectDistrict}
            onSelectBillboard={onSelectBillboard}
            {...(onSelectProperty ? { onSelectProperty } : {})}
            eventChips={_eventChips}
            {...(onSelectEvent ? { onSelectEvent } : {})}
            onReady={handleReady}
            onUnavailable={handleUnavailable}
          />
        )}
      </Suspense>
      {rendererState === "loading" && (
        <div className="town-map-renderer-status">
          <WorldLoadingIndicator
            presentation="screen"
            title="Opening the map"
            detail="Loading the town…"
          />
        </div>
      )}
      {rendererState === "unavailable" && (
        <div className="town-map-renderer-status" role="alert">
          <p>The 3D town could not start on this device.</p>
          <button
            type="button"
            className="phone-btn-primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      )}
      <ul className="town-map-accessible-list" aria-label="Places on the map">
        {properties?.map((property) => (
          <li key={property.id}>
            <button
              type="button"
              onClick={() => onSelectProperty?.(property)}
              aria-label={"Open " + (property.label ?? "house") + ": " + houseBadgeText(property)}
            >
              {property.label ?? "House"}, {houseBadgeText(property)} · View property
            </button>
          </li>
        ))}
        {availablePlaces.map((place) => (
          <li key={place.id}>
            <button type="button" onClick={() => onSelectLandmark(place.id)}>
              {place.label}, {place.category}
            </button>
          </li>
        ))}
        {_eventChips.map((event) => (
          <li key={event.id}>
            <button type="button" onClick={() => onSelectEvent?.(event.id)}>
              Live event: {event.label}
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
