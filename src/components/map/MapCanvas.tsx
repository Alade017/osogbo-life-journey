import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import townData from "@/data/osogbo-town.json";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";

const TownSurface3D = lazy(() =>
  import("./R3FTownSurface").then((module) => ({ default: module.R3FTownSurface })),
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
  districtId?: string | undefined;
  id: string;
  label?: string | undefined;
  type: "compound" | "flat" | "shophouse";
  tier: 1 | 2 | 3;
  status: "owned" | "current" | "rent_due" | "overdue" | "vacant";
  position: [number, number, number];
  rotation?: number | undefined;
  ownerName?: string | undefined;
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
  travelMode,
  travelPending,
  playerLocation,
  eventChips: _eventChips = [],
  billboardMarkers = [],
  availableLandmarkIds,
  onSelectBillboard,
  properties,
  onSelectProperty,
  onSelectEvent,
}: MapCanvasProps) {
  const container = useRef<HTMLElement>(null);
  const [focusInsets, setFocusInsets] = useState({ right: 0, bottom: 0 });
  useEffect(() => {
    if (!selectedLandmarkId) return; // Closing must not move the camera back.
    const sheet = document.querySelector(".destination-sheet");
    const map = container.current;
    if (!sheet || !map || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const m = map.getBoundingClientRect(),
        s = sheet.getBoundingClientRect();
      const intersects =
        s.left < m.right && s.right > m.left && s.top < m.bottom && s.bottom > m.top;
      const mobile = window.matchMedia("(max-width: 640px)").matches;
      const next = !intersects
        ? { right: 0, bottom: 0 }
        : mobile
          ? { right: 0, bottom: Math.max(0, m.bottom - s.top) }
          : { right: Math.max(0, m.right - s.left), bottom: 0 };
      setFocusInsets((old) =>
        old.right === next.right && old.bottom === next.bottom ? old : next,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(sheet);
    observer.observe(map);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [selectedLandmarkId]);
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
    if (townData.landmarks.some((landmark) => landmark.id === id)) {
      onSelectLandmark(id);
      return;
    }
    if (townData.districts.some((district) => district.id === id)) onSelectDistrict(id);
  }, [onSelectDistrict, onSelectLandmark, searchTarget]);

  const availablePlaces = useMemo(
    () =>
      townData.landmarks.filter(
        (place) => availableLandmarkIds === undefined || availableLandmarkIds.includes(place.id),
      ),
    [availableLandmarkIds],
  );
  // Keep locked landmarks visible as non-interactive pins.
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
      ref={container}
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
            selectedLandmarkId={selectedLandmarkId}
            travelMode={travelMode}
            travelPending={travelPending}
            focusInsets={focusInsets}
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
