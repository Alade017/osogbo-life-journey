import {
  Component,
  type ReactNode,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import townData from "@/data/osogbo-town.json";
import {
  overviewDistrictId,
  overviewDistricts,
  overviewHasPlace,
} from "./overview-district-routing";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";

const TownSurface3D = lazy(() =>
  import("./DistrictOverviewSurface").then((module) => ({
    default: module.DistrictOverviewSurface,
  })),
);

class MapLoadBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onUnavailable();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

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
  availabilityPending?: boolean | undefined;
  /** Pass undefined while the existing property source is loading. */
  properties?: readonly MapProperty[] | undefined;
  onSelectProperty?: (property: MapProperty) => void | undefined;
  onSelectEvent?: (landmarkId: string) => void | undefined;
}

const EMPTY_EVENTS: MapEventChip[] = [];
const EMPTY_BILLBOARDS: MapBillboardMarker[] = [];

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
  eventChips: _eventChips = EMPTY_EVENTS,
  billboardMarkers = EMPTY_BILLBOARDS,
  availableLandmarkIds,
  availabilityPending = false,
  onSelectBillboard,
  properties,
  onSelectProperty,
  onSelectEvent,
}: MapCanvasProps) {
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [cameraFocus, setCameraFocus] = useState<MapSearchTarget | null>(null);
  const [resetVersion, setResetVersion] = useState(0);
  const [zoomRequest, setZoomRequest] = useState({ step: 0, version: 0 });
  const selectDistrict = useCallback(
    (id: string) => {
      setCameraFocus({ id, kind: "district" });
      onSelectDistrict(id);
    },
    [onSelectDistrict],
  );
  const [rendererState, setRendererState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  const handledSearchTarget = useRef<MapCanvasProps["searchTarget"]>(undefined);
  useEffect(() => {
    // A search is a navigation request, not a command to replay on each parent render.
    if (handledSearchTarget.current === searchTarget) return;
    if (!searchTarget) {
      handledSearchTarget.current = searchTarget;
      return;
    }
    const id = typeof searchTarget === "string" ? searchTarget : searchTarget.id;
    const kind = typeof searchTarget === "string" ? undefined : searchTarget.kind;
    if (kind !== "district" && overviewHasPlace(id)) {
      if (availabilityPending) return;
      handledSearchTarget.current = searchTarget;
      setCameraFocus(searchTarget);
      if (availableLandmarkIds === undefined || availableLandmarkIds.includes(id)) {
        setNotice(null);
        onSelectLandmark(id);
      } else setNotice("This destination is currently unavailable.");
      return;
    }
    handledSearchTarget.current = searchTarget;
    setCameraFocus(searchTarget);
    if (kind !== "landmark") {
      const districtId = overviewDistrictId(id);
      if (districtId) onSelectDistrict(districtId);
    }
  }, [onSelectDistrict, onSelectLandmark, searchTarget, availabilityPending, availableLandmarkIds]);

  const availablePlaces = useMemo(
    () =>
      townData.landmarks.filter(
        (place) =>
          overviewHasPlace(place.id) &&
          (availableLandmarkIds === undefined || availableLandmarkIds.includes(place.id)),
      ),
    [availableLandmarkIds],
  );
  const availableIds = useMemo(() => availablePlaces.map((place) => place.id), [availablePlaces]);
  const availableSet = useMemo(() => new Set(availableIds), [availableIds]);
  const selectableEvents = useMemo(
    () =>
      availabilityPending
        ? EMPTY_EVENTS
        : _eventChips.filter((event) => availableSet.has(event.id)),
    [_eventChips, availableSet, availabilityPending],
  );
  const selectLandmark = useCallback(
    (id: string) => {
      if (availabilityPending) {
        setNotice("Checking destination access…");
        return;
      }
      if (!availableSet.has(id)) return;
      setNotice(null);
      onSelectLandmark(id);
    },
    [availableSet, availabilityPending, onSelectLandmark],
  );
  const selectUnavailable = useCallback(
    (id: string, reason: "locked" | "reserved") => {
      setCameraFocus({ id, kind: "landmark" });
      setNotice(
        reason === "reserved"
          ? "This landmark is not open for travel yet."
          : availabilityPending
            ? "Checking destination access…"
            : "This destination is currently unavailable.",
      );
    },
    [availabilityPending],
  );
  const handleReady = useCallback(() => setRendererState("ready"), []);
  const handleUnavailable = useCallback(() => setRendererState("unavailable"), []);

  return (
    <section
      className="map-canvas town-map-canvas"
      style={{ background: WORLD_PALETTE.ground }}
      aria-label="Interactive 3D town map with open camera exploration"
    >
      <MapLoadBoundary key={rendererAttempt} onUnavailable={handleUnavailable}>
        <Suspense fallback={null}>
          {rendererState !== "unavailable" && (
            <TownSurface3D
              availableLandmarkIds={availableIds}
              searchTarget={cameraFocus}
              resetVersion={resetVersion}
              zoomRequest={zoomRequest}
              selectedLandmarkId={selectedLandmarkId}
              onSelectLandmark={selectLandmark}
              onSelectUnavailable={selectUnavailable}
              onSelectDistrict={selectDistrict}
              onSelectBillboard={onSelectBillboard}
              eventChips={selectableEvents}
              onSelectEvent={onSelectEvent}
              billboardMarkers={billboardMarkers}
              properties={properties}
              onSelectProperty={onSelectProperty}
              onReady={handleReady}
              onUnavailable={handleUnavailable}
            />
          )}
        </Suspense>
      </MapLoadBoundary>
      {rendererState === "ready" && (
        <div className="town-map-zoom-controls" aria-label="Map camera controls">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoomRequest((old) => ({ step: 1, version: old.version + 1 }))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoomRequest((old) => ({ step: -1, version: old.version + 1 }))}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Reset map camera"
            onClick={() => {
              setCameraFocus(null);
              setZoomRequest({ step: 0, version: 0 });
              setResetVersion((old) => old + 1);
            }}
          >
            ↺
          </button>
        </div>
      )}
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
          <p>The 3D town is unavailable. You can retry the renderer without reloading your game.</p>
          <button
            type="button"
            className="phone-btn-primary"
            onClick={() => {
              setResetVersion(0);
              setZoomRequest({ step: 0, version: 0 });
              setRendererState("loading");
              setRendererAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {notice && (
        <div className="overview-access-notice" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss destination notice"
          >
            ×
          </button>
        </div>
      )}
      {!!properties?.length && (
        <details className="overview-property-panel">
          <summary>Properties</summary>
          <p>
            Listings with a known housing type appear on the map; other properties remain available
            here.
          </p>
          <ul aria-label="Existing properties">
            {properties.map((property) => (
              <li key={property.id}>
                <button
                  type="button"
                  onClick={() => onSelectProperty?.(property)}
                  aria-label={
                    "Open " + (property.label ?? "house") + ": " + houseBadgeText(property)
                  }
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
            <button type="button" onClick={() => selectLandmark(place.id)}>
              {place.label}, {place.category}
            </button>
          </li>
        ))}
        {selectableEvents.map((event) => (
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
