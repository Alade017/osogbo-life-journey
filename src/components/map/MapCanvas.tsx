import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import townData from "@/data/osogbo-town.json";
import { overviewDistrictId, overviewDistricts, overviewHasPlace } from "./overview-district-routing";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";

const TownSurface3D = lazy(() =>
  import("./DistrictOverviewSurface").then((module) => ({ default: module.DistrictOverviewSurface })),
);

export type MapSearchTarget = string | { id: string; kind?: "district" | "landmark" };
export type MapPlayerLocation = {
  x: number;
  y: number;
  label?: string | undefined;
  activity?: string | undefined;
  markerType?: "player" | "stall" | "job" | undefined;
};
export type MapEventChip = { id: string; label: string; x: number; y: number };
export type MapBillboardMarker = {
  campaignId: string;
  landmarkId: string;
  advertiserName: string;
  title?: string | undefined;
  imageUrl?: string | null | undefined;
  count: number;
};

/** Display-only property input. Ownership, rent, and status remain server/game-state owned. */
export type MapProperty = {
  id: string;
  label?: string | undefined;
  type: "compound" | "flat" | "shophouse";
  tier: 1 | 2 | 3;
  status: "owned" | "current" | "rent_due" | "overdue" | "vacant";
  position: [number, number, number];
  rotation?: number | undefined;
  ownerName?: string | undefined;
  houseTypeId?: string | undefined;
};

export interface MapCanvasProps {
  onSelectDistrict: (id: string) => void;
  onSelectLandmark: (id: string) => void;
  searchTarget?: MapSearchTarget | null | undefined;
  selectedLandmarkId?: string | null | undefined;
  travelMode?: import("@/lib/transport-service").TravelMode | null | undefined;
  travelPending?: boolean | undefined;
  playerLocation?: MapPlayerLocation | null | undefined;
  eventChips?: MapEventChip[] | undefined;
  billboardMarkers?: MapBillboardMarker[] | undefined;
  onSelectBillboard?: (campaignId: string) => void | undefined;
  availableLandmarkIds?: readonly string[] | undefined;
  /** Pass undefined while the existing property source is loading. */
  properties?: readonly MapProperty[] | undefined;
  onSelectProperty?: (property: MapProperty) => void | undefined;
  onSelectEvent?: (landmarkId: string) => void | undefined;
}

const propertyStatusText: Record<MapProperty["status"], string> = {
  owned: "Owned",
  current: "Your home",
  rent_due: "Rent due",
  overdue: "Rent overdue",
  vacant: "Vacant",
};

function houseBadgeText(property: MapProperty) {
  if (property.status === "owned" && property.ownerName) return property.ownerName;
  return propertyStatusText[property.status];
}

export function MapCanvas({
  onSelectDistrict,
  onSelectLandmark,
  searchTarget,
  selectedLandmarkId,
  eventChips: _eventChips = [],
  billboardMarkers = [],
  availableLandmarkIds,
  onSelectBillboard,
  properties,
  onSelectProperty,
  onSelectEvent,
}: MapCanvasProps) {
  const [districtFocus, setDistrictFocus] = useState<MapSearchTarget | null>(null);
  const selectDistrict = (id: string) => {
    setDistrictFocus({ id, kind: "district" });
    onSelectDistrict(id);
  };
  const [rendererState, setRendererState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  const handledSearchTarget = useRef<MapCanvasProps["searchTarget"]>(undefined);
  useEffect(() => {
    // A search is a navigation request, not a command to replay on each parent render.
    if (handledSearchTarget.current === searchTarget) return;
    handledSearchTarget.current = searchTarget;
    if (!searchTarget) return;
    const id = typeof searchTarget === "string" ? searchTarget : searchTarget.id;
    const kind = typeof searchTarget === "string" ? undefined : searchTarget.kind;
    if (kind !== "district" && overviewHasPlace(id)) {
      onSelectLandmark(id);
      return;
    }
    if (kind !== "landmark") {
      const districtId = overviewDistrictId(id);
      if (districtId) onSelectDistrict(districtId);
    }
  }, [onSelectDistrict, onSelectLandmark, searchTarget]);

  const availablePlaces = useMemo(
    () =>
      townData.landmarks.filter(
        (place) => overviewHasPlace(place.id) && (availableLandmarkIds === undefined || availableLandmarkIds.includes(place.id)),
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
            availableLandmarkIds={availablePlaces.map(place => place.id)}
            searchTarget={searchTarget ?? districtFocus}
            selectedLandmarkId={selectedLandmarkId}
            onSelectLandmark={onSelectLandmark}
            onSelectDistrict={selectDistrict}
            onSelectBillboard={onSelectBillboard}
            eventChips={_eventChips}
            onSelectEvent={onSelectEvent}
            billboardMarkers={billboardMarkers}
            properties={properties}
            onSelectProperty={onSelectProperty}
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
        <div className="town-map-renderer-status" role="alert" style={{ pointerEvents: "auto" }}>
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
      {!!properties?.length && (
        <details style={{ position: "absolute", top: 12, left: 12, zIndex: 4, maxWidth: "min(18rem, 90%)", maxHeight: "60%", overflow: "auto", background: "var(--card)", color: "var(--foreground)", padding: "0.5rem", borderRadius: 8 }}>
          <summary>Properties</summary>
          <p>Listings with a known housing type appear on the map; other properties remain available here.</p>
          <ul aria-label="Existing properties">
        {properties.map((property) => (
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
          </ul>
        </details>
      )}
      <ul className="town-map-accessible-list" aria-label="Places on the map">
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
        {overviewDistricts.map((district) => (
          <li key={district.id}>
            <button type="button" onClick={() => selectDistrict(district.id)}>
              {district.name} district
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
