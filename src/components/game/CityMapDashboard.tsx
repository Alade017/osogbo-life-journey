import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { requestDepartureFromHome } from "@/lib/home-departure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CloudOff, MapPinned, Smile, Compass, Lock, X } from "lucide-react";
import {
  MapCanvas,
  type MapBillboardMarker,
  type MapFilter,
  type MapSearchTarget,
  type MapEventChip,
} from "@/components/map/MapCanvas";
import { mapHousingMarkers } from "@/components/map/map-housing-markers";
import { DistrictSheet } from "@/components/map/DistrictSheet";
import { LandmarkSheet } from "@/components/map/LandmarkSheet";
import { MapTravelSelector } from "@/components/map/MapTravelSelector";
import { MapBillboardCampaignDialog } from "@/components/game/CityBillboards";
import { OsunStateOverview } from "@/components/map/OsunStateOverview";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";
import townData from "@/data/osogbo-town.json";
import { q, rpc } from "@/lib/game";
import { isPlayableDistrict } from "@/game/playable-district";
import { INITIAL_GAME_TIME, gameTimeFromCharacter } from "@/lib/game-time";
import { useWorldClock } from "@/hooks/use-world-clock";
import { supabase } from "@/integrations/supabase/client";
import {
  requestMapPlaceAction,
  getPendingMapActionKey,
  clearPendingMapActionKey,
  requestAvailableMapLandmarks,
} from "@/lib/map-api";
import type { TravelMode } from "@/lib/transport-service";
import type { PlaceActionResult } from "@/components/map/PlaceActionMenu";
import { useCityEvents } from "@/hooks/use-city-events";
import { cityEventsForDistrict } from "@/lib/city-event-service";
import { getCurrentMapBillboards, type CurrentMapBillboard } from "@/lib/map-billboard-map";
import type { MapDistrict, MapLandmark } from "@/components/map/map-types";
import "@/components/map/map-ui.css";
import "@/components/map/map-hud.css";
import { MapTicker } from "@/components/map/MapTicker";

const categories: { id: MapFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "jobs", label: "Jobs" },
  { id: "food", label: "Food" },
  { id: "market", label: "Markets" },
  { id: "health", label: "Health" },
  { id: "school", label: "Schools" },
  { id: "services", label: "Services" },
  { id: "worship", label: "Worship" },
  { id: "transport", label: "Transport" },
  { id: "junction", label: "Junctions" },
  { id: "sport", label: "Sport" },
];
const townLandmarks = townData.landmarks as (MapLandmark & { districtId: string })[];
const districts = townData.districts.map((district) => ({
  ...district,
  landmarks: townLandmarks.filter((landmark) => landmark.districtId === district.id),
})) as unknown as MapDistrict[];
const landmarks = districts.flatMap((district) =>
  district.landmarks.map((landmark) => ({ ...landmark, district })),
);
const quickTravelLandmarkDetails: Record<
  string,
  { districtId: string; label: string; category: MapLandmark["category"] }
> = {
  "olaiya-junction": {
    districtId: "central-crossing",
    label: "Olaiya Junction",
    category: "junction",
  },
  "oja-oba-market": {
    districtId: "market-quarter",
    label: "Oja-Oba Market",
    category: "market",
  },
};

function getQuickTravelLandmark(id: string) {
  const details = quickTravelLandmarkDetails[id];
  if (!details) return null;
  const district = districts.find((item) => item.id === details.districtId);
  const reference = district?.landmarks[0] ?? landmarks[0];
  if (!district || !reference) return null;
  return {
    ...reference,
    id,
    label: details.label,
    category: details.category,
    verify: true,
    actions: [],
    district,
  };
}

export function CityMapDashboard({
  mood,
  nextRentDueAt,
}: { money?: number; mood?: string; nextRentDueAt?: string } = {}) {
  const [selectedDistrict, setSelectedDistrict] = useState<MapDistrict | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<
    (MapLandmark & { district: MapDistrict }) | null
  >(null);
  const [landmarkDetailsOpen, setLandmarkDetailsOpen] = useState(false);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [search, setSearch] = useState("");
  const [searchTarget, setSearchTarget] = useState<MapSearchTarget | null>(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [travelError, setTravelError] = useState<string | null>(null);
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
  const [refreshingArrival, setRefreshingArrival] = useState(false);
  const [actionError, setActionError] = useState("");
  const [placeActionResult, setPlaceActionResult] = useState<PlaceActionResult | null>(null);
  const [selectedBillboard, setSelectedBillboard] = useState<CurrentMapBillboard | null>(null);
  const [billboardNow, setBillboardNow] = useState(() => Date.now());
  const [mapLevel, setMapLevel] = useState<"town" | "state">("town");
  const [selectedTownId, setSelectedTownId] = useState("osogbo");
  const [soonOpen, setSoonOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const travelSubmitLock = useRef(false);
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const character = useQuery(q.character());
  const housingMarkers = useQuery({
    queryKey: ["housingMapProperties", character.data?.id],
    enabled: !!character.data?.id && !offline,
    staleTime: 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("Sign in again to load homes.");
      const response = await fetch("/api/housing/map-properties", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) throw new Error("Homes on the map could not be loaded.");
      return mapHousingMarkers(await response.json());
    },
  });
  const rent = useQuery(q.rentStatus());
  const wallet = useQuery(q.wallet());
  const worldClock = useWorldClock();
  const cityEvents = useCityEvents();
  const jobCatalog = useQuery({ ...q.jobs(), enabled: filter === "jobs" });
  const locations = useQuery(q.locations());
  const availableLandmarks = useQuery({
    queryKey: ["mapAvailableLandmarks"],
    queryFn: requestAvailableMapLandmarks,
    staleTime: 60_000,
    enabled: !offline,
  });
  const currentLocation = locations.data?.find(
    (row) => row.id === character.data?.current_location_id,
  );
  const selectedDestinationSlug = selectedLandmark
    ? MAP_LANDMARK_LOCATION_SLUG[selectedLandmark.id]
    : null;
  const selectedDestination = selectedDestinationSlug
    ? (locations.data?.find((row) => row.slug === selectedDestinationSlug) ?? null)
    : null;
  const currentMapPlace = currentLocation
    ? townData.landmarks.find(
        (place) =>
          MAP_LANDMARK_LOCATION_SLUG[place.id] === currentLocation.slug &&
          availableLandmarks.data?.includes(place.id),
      )
    : null;
  const billboards = useQuery(q.billboards());
  const advertisements = useQuery(q.advertisements());
  const playerAdvertisements = useQuery(q.playerAdvertisements());
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setBillboardNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  const activeMapBillboards = useMemo(
    () =>
      getCurrentMapBillboards(
        billboards.data ?? [],
        advertisements.data ?? [],
        playerAdvertisements.data ?? [],
        locations.data ?? [],
        billboardNow,
      ),
    [advertisements.data, billboardNow, billboards.data, locations.data, playerAdvertisements.data],
  );
  const billboardMarkers: MapBillboardMarker[] = activeMapBillboards.map((entry) => ({
    campaignId: entry.advertisement.id,
    landmarkId: entry.landmarkId,
    advertiserName: entry.advertisement.advertiser_name,
    title: entry.advertisement.title,
    imageUrl: entry.advertisement.creative_image_url,
    count: entry.count,
  }));
  const activeEvents = cityEvents.isError
    ? []
    : cityEventsForDistrict(cityEvents.data?.events ?? [], selectedDistrict?.id);
  const eventChips: MapEventChip[] = (cityEvents.data?.events ?? [])
    .filter((event) => event.status === "active")
    .flatMap((event) => {
      const landmark = townData.landmarks.find((place) => place.id === event.landmarkId);
      return landmark
        ? [{ id: event.landmarkId, label: event.title, x: landmark.grid.x, y: landmark.grid.z }]
        : [];
    })
    .filter((event, index, events) => events.findIndex((item) => item.id === event.id) === index);
  const landmarkEvent = cityEvents.isError
    ? undefined
    : cityEvents.data?.events.find(
        (event) => event.status === "active" && event.landmarkId === selectedLandmark?.id,
      );
  const refreshConfirmedArrival = async (locationId: string) => {
    if (isMounted.current) {
      setRefreshingArrival(true);
      setTravelError(null);
    }
    try {
      const savedCharacter = await queryClient.fetchQuery(q.character());
      if (!isMounted.current) return;
      if (savedCharacter?.current_location_id !== locationId) {
        setTravelError("Travel is confirmed, but the saved destination has not refreshed yet.");
        return;
      }
      await navigate({ to: "/neighborhood" });
    } catch (error) {
      if (!isMounted.current) return;
      setTravelError(
        error instanceof Error
          ? `Travel is confirmed, but your destination could not be loaded: ${error.message}`
          : "Travel is confirmed, but your destination could not be loaded. Please retry.",
      );
    } finally {
      if (isMounted.current) setRefreshingArrival(false);
    }
  };
  const travel = useMutation({
    mutationFn: ({ locationId, mode }: { locationId: string; mode: TravelMode }) =>
      rpc.travelToLocation({ locationId, mode }),
    onSuccess: async (_result, variables) => {
      if (isMounted.current) {
        setArrivalConfirmed(true);
        setTravelError(null);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["character"], refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: ["locations"], refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["worldClock"] }),
        queryClient.invalidateQueries({ queryKey: ["visits"] }),
      ]);
      window.dispatchEvent(new Event("osogbo:server-state-changed"));
      await refreshConfirmedArrival(variables.locationId);
    },
    onError: (error) => {
      if (isMounted.current) {
        setTravelError(error instanceof Error ? error.message : "Travel could not be completed.");
      }
    },
    onSettled: () => {
      travelSubmitLock.current = false;
    },
  });
  const apply = useMutation({
    mutationFn: (id: string) => rpc.selectJob(id),
    onSuccess: async () => {
      setActionError("");
      await queryClient.invalidateQueries({ queryKey: ["character"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e) => setActionError(e.message),
  });
  const runPlaceAction = useMutation({
    mutationFn: ({
      landmarkId,
      actionId,
      requestId,
      accountId,
      characterId,
    }: {
      landmarkId: string;
      actionId: string;
      requestId: string;
      accountId: string;
      characterId: string;
    }) => requestMapPlaceAction(landmarkId, actionId, requestId, accountId),
    onSuccess: async (result, variables) => {
      setPlaceActionResult(result);
      setActionError("");
      clearPendingMapActionKey(
        variables.accountId,
        variables.characterId,
        variables.landmarkId,
        variables.actionId,
        variables.requestId,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["character"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["worldClock"] }),
        queryClient.invalidateQueries({ queryKey: ["mapLandmarkDetails", variables.landmarkId] }),
      ]);
      window.dispatchEvent(new Event("osogbo:server-state-changed"));
    },
    onError: (error, variables) => {
      const messages: Record<string, string> = {
        NOT_AT_PLACE: "Travel here before starting this activity.",
        PLACE_CLOSED: "This place is closed right now.",
        INSUFFICIENT_FUNDS: "You do not have enough money for this activity.",
        REQUIREMENT_NOT_MET: "Meet this activity's requirement before trying again.",
        COOLDOWN: "Wait a little before repeating that activity.",
      };
      setActionError(
        messages[error.message] ?? "The activity could not be completed. Please retry.",
      );
      if (error.message === "PLACE_CLOSED") {
        void queryClient.invalidateQueries({
          queryKey: ["mapLandmarkDetails", variables.landmarkId],
        });
      }
    },
  });
  const confirmTravel = (mode: TravelMode) => {
    if (travelSubmitLock.current || !selectedDestination || travel.isPending) return;
    travelSubmitLock.current = true;
    setTravelError(null);
    if (character.data?.inside_home_property_id) {
      // Leaving a house plays the door first; the house screen runs the trip alongside it.
      requestDepartureFromHome({ locationId: selectedDestination.id, mode });
      void navigate({ to: "/house" }).finally(() => {
        travelSubmitLock.current = false;
      });
      return;
    }
    travel.mutate({ locationId: selectedDestination.id, mode });
  };
  const closeTravelSelector = () => {
    setSelectedLandmark(null);
    setLandmarkDetailsOpen(false);
    setTravelError(null);
    setArrivalConfirmed(false);
  };
  const onDistrict = (id: string) => {
    const d = districts.find((item) => item.id === id);
    if (d) {
      setSelectedLandmark(null);
      setSelectedDistrict(d);
    }
  };
  const onLandmark = (id: string) => {
    if (!availableLandmarks.data?.includes(id)) return;
    const found = landmarks.find((item) => item.id === id) ?? getQuickTravelLandmark(id);
    if (found) {
      setSelectedDistrict(null);
      setSelectedLandmark(found);
      setLandmarkDetailsOpen(false);
      setArrivalConfirmed(false);
      setTravelError(null);
      setActionError("");
      setPlaceActionResult(null);
    }
  };
  const searchMatches = useMemo(() => {
    const value = search.trim().toLocaleLowerCase();
    if (!value) return null;
    return (
      [
        ...districts.map((d) => ({ id: d.id, kind: "district" as const, label: d.name })),
        ...landmarks
          .filter((l) => availableLandmarks.data?.includes(l.id))
          .map((l) => ({ id: l.id, kind: "landmark" as const, label: l.label })),
      ]
        .map((item) => ({
          ...item,
          score:
            item.label.toLocaleLowerCase() === value
              ? 0
              : item.label.toLocaleLowerCase().startsWith(value)
                ? 1
                : item.label.toLocaleLowerCase().includes(value)
                  ? 2
                  : 3,
        }))
        .filter((x) => x.score < 3)
        .sort((a, b) => a.score - b.score)[0] ?? null
    );
  }, [availableLandmarks.data, search]);
  const locationsWithJobs = new Set(
    (jobCatalog.data ?? []).flatMap((job) => (job.location_id ? [job.location_id] : [])),
  );
  const jobLandmarkIds = landmarks
    .filter((landmark) => {
      const slug = MAP_LANDMARK_LOCATION_SLUG[landmark.id];
      const locationRow = locations.data?.find((row) => row.slug === slug);
      return !!locationRow && locationsWithJobs.has(locationRow.id);
    })
    .map((item) => item.id);
  const submitSearch = () => {
    if (!searchMatches) return;
    setSearchTarget({ id: searchMatches.id, kind: searchMatches.kind });
  };
  const rentRecord = rent.data as { next_due_at?: string; due_at?: string } | null;
  const due = nextRentDueAt ?? rentRecord?.next_due_at ?? rentRecord?.due_at;
  const availableIds = availableLandmarks.data;
  const lockedPlaces = availableIds
    ? townLandmarks.filter((place) => !availableIds.includes(place.id))
    : [];
  const displayedMood =
    mood ??
    (character.data?.happiness != null
      ? character.data.happiness > 75
        ? "Cheerful"
        : character.data.happiness > 45
          ? "Content"
          : "Low"
      : "Settled");

  return (
    <section className="city-map-dashboard is-world-map map-experience" aria-label="Osun Life map">
      <header className="map-hud">
        <div className="map-hud-status" aria-label="Map status">
          <span className="map-hud-chip">
            <Smile size={15} aria-hidden="true" />
            <strong>{displayedMood}</strong>
          </span>
          <span className="map-hud-chip">
            <CalendarDays size={15} aria-hidden="true" />
            <small>Rent</small>
            <strong>
              {due
                ? new Intl.DateTimeFormat("en-NG", {
                    timeZone: "Africa/Lagos",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(due))
                : "Not scheduled"}
            </strong>
          </span>
          {mapLevel === "town" && lockedPlaces.length > 0 && (
            <button
              type="button"
              className="map-soon-button"
              aria-expanded={soonOpen}
              onClick={() => setSoonOpen(true)}
            >
              <Lock size={13} aria-hidden="true" />
              <strong>{lockedPlaces.length}</strong>
              <small>coming soon</small>
            </button>
          )}
        </div>
        <div className="map-hud-actions">
          <button
            className="map-level-toggle"
            type="button"
            onClick={() => setMapLevel((level) => (level === "town" ? "state" : "town"))}
          >
            <MapPinned size={16} />
            {mapLevel === "town" ? "Explore Osun" : "Osogbo map"}
          </button>
          {mapLevel === "town" && isPlayableDistrict(currentLocation?.slug) && (
            <Link className="map-neighborhood-link" to="/neighborhood">
              {currentLocation?.slug === "oja-oba" ? "Walk Oja-Oba Market" : "Walk Olaiya"}
            </Link>
          )}
          {mapLevel === "town" && currentLocation?.slug !== "oja-oba" && (
            <button
              className="map-neighborhood-link"
              type="button"
              onClick={() => onLandmark("oja-oba-market")}
            >
              Visit Oja-Oba Market
            </button>
          )}
          {mapLevel === "town" &&
            currentLocation?.slug !== "city-centre" &&
            availableLandmarks.data?.includes("olaiya-junction") && (
              <button
                className="map-neighborhood-link"
                type="button"
                disabled={offline}
                onClick={() => onLandmark("olaiya-junction")}
              >
                Travel to Olaiya
              </button>
            )}
        </div>
      </header>
      <MapTicker />
      {offline && (
        <div role="status" className="map-offline-banner">
          <CloudOff size={16} />
          Offline. Showing your last saved map.
        </div>
      )}
      {soonOpen && (
        <div className="map-sheet map-soon-sheet" role="dialog" aria-label="Places coming soon">
          <header className="map-sheet-header">
            <div>
              <p className="map-sheet-eyebrow">Coming to Osun</p>
              <h2>{lockedPlaces.length} places in progress</h2>
            </div>
            <button
              type="button"
              className="map-icon-button"
              aria-label="Close"
              onClick={() => setSoonOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <ul className="map-soon-list">
            {lockedPlaces.map((place) => (
              <li key={place.id}>
                <span className="map-soon-icon">
                  <Lock size={14} aria-hidden="true" />
                </span>
                <span>{place.label}</span>
                <small>Coming soon</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!offline && housingMarkers.isLoading && (
        <div role="status" className="map-housing-message">
          Loading property markers…
        </div>
      )}
      {!offline && housingMarkers.isError && (
        <div role="alert" className="map-housing-message">
          <span>
            {housingMarkers.data
              ? "Property updates could not be refreshed. Showing the last successfully loaded homes."
              : "Homes could not be loaded. The town map is still available."}
          </span>
          <button type="button" onClick={() => void housingMarkers.refetch()}>
            Retry
          </button>
        </div>
      )}
      {!offline && availableLandmarks.isError && (
        <div role="alert" className="map-housing-message">
          Places could not be loaded. Reconnect to browse the town.
        </div>
      )}
      {mapLevel === "town" && (
        <div className="map-controls">
          <div className="map-category-chips" aria-label="Filter places">
            {categories.map((c) => (
              <button
                key={c.id}
                aria-pressed={filter === c.id}
                onClick={() => setFilter(c.id === "all" ? "all" : filter === c.id ? "all" : c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <form
            className="map-search"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <input
              aria-label="Search districts and landmarks"
              placeholder="Search map"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" disabled={!searchMatches}>
              Search
            </button>
          </form>
        </div>
      )}
      {mapLevel === "town" ? (
        <MapCanvas
          playerLocation={
            currentMapPlace
              ? { x: currentMapPlace.grid.x, y: currentMapPlace.grid.z, label: "You are here" }
              : null
          }
          properties={housingMarkers.data}
          eventChips={eventChips}
          onSelectEvent={(landmarkId) => {
            const event = (cityEvents.data?.events ?? []).find(
              (item) => item.status === "active" && item.landmarkId === landmarkId,
            );
            const found =
              landmarks.find((item) => item.id === landmarkId) ??
              getQuickTravelLandmark(landmarkId);
            if (!event || !found) return;
            setSelectedDistrict(null);
            setSelectedLandmark(found);
            setLandmarkDetailsOpen(true);
            setArrivalConfirmed(false);
            setTravelError(null);
            setActionError("");
            setPlaceActionResult(null);
          }}
          availableLandmarkIds={availableLandmarks.data ?? []}
          onSelectDistrict={onDistrict}
          onSelectLandmark={onLandmark}
          activeFilter={filter}
          searchTarget={searchTarget}
          jobLandmarkIds={jobLandmarkIds}
          billboardMarkers={billboardMarkers}
          onSelectBillboard={(campaignId) => {
            setSelectedBillboard(
              activeMapBillboards.find(({ advertisement }) => advertisement.id === campaignId) ??
                null,
            );
          }}
          onSelectProperty={(property) => {
            window.dispatchEvent(
              new CustomEvent("osogbo-open-phone-app", {
                detail: { app: property.status === "vacant" ? "Find homes" : "Property" },
              }),
            );
          }}
        />
      ) : (
        <OsunStateOverview
          selectedTownId={selectedTownId}
          onSelectTown={setSelectedTownId}
          onOpenOsogbo={() => setMapLevel("town")}
        />
      )}
      <MapBillboardCampaignDialog
        campaign={selectedBillboard}
        onClose={() => setSelectedBillboard(null)}
      />
      {mapLevel === "town" && selectedDistrict && (
        <DistrictSheet
          district={{
            ...selectedDistrict,
            landmarks: selectedDistrict.landmarks.filter((landmark) =>
              availableLandmarks.data?.includes(landmark.id),
            ),
          }}
          event={
            activeEvents[0]
              ? { label: activeEvents[0].title, endsAt: activeEvents[0].endsAt }
              : null
          }
          onClose={() => setSelectedDistrict(null)}
          onLandmark={onLandmark}
        />
      )}
      {mapLevel === "town" && selectedLandmark && !landmarkDetailsOpen && (
        <MapTravelSelector
          open
          landmark={selectedLandmark}
          districtName={selectedLandmark.district.name}
          {...(character.data?.user_id ? { accountId: character.data.user_id } : {})}
          {...(character.data?.id ? { characterId: character.data.id } : {})}
          destination={selectedDestination ?? null}
          isLoadingDestination={locations.isLoading}
          destinationLoadError={locations.isError}
          onRetryDestination={() => void locations.refetch()}
          originName={currentLocation?.name ?? "Current location"}
          currentLocationId={character.data?.current_location_id ?? null}
          characterLevel={character.data?.level ?? null}
          walletBalance={wallet.data?.balance ?? null}
          walletLoading={wallet.isLoading}
          gameTime={
            worldClock.data ??
            (character.data ? gameTimeFromCharacter(character.data) : INITIAL_GAME_TIME)
          }
          offline={offline}
          pending={travel.isPending}
          arrivalConfirmed={arrivalConfirmed}
          refreshingArrival={refreshingArrival}
          error={travelError}
          onConfirm={confirmTravel}
          onCancel={closeTravelSelector}
          onOpenDetails={() => setLandmarkDetailsOpen(true)}
          onRetryArrival={() => {
            if (selectedDestination) void refreshConfirmedArrival(selectedDestination.id);
          }}
        />
      )}
      {mapLevel === "town" && selectedLandmark && landmarkDetailsOpen && (
        <LandmarkSheet
          key={selectedLandmark.id}
          accountId={character.data?.user_id ?? undefined}
          characterId={character.data?.id ?? undefined}
          landmark={selectedLandmark}
          event={
            landmarkEvent ? { label: landmarkEvent.title, endsAt: landmarkEvent.endsAt } : null
          }
          description={
            selectedLandmark.category === "worship"
              ? "This map marker is informational and is not an in-game destination."
              : `${selectedLandmark.category[0]!.toUpperCase()}${selectedLandmark.category.slice(1)} destination in ${selectedLandmark.district.name}.`
          }
          locationName={selectedLandmark.district.name}
          offline={offline}
          onClose={closeTravelSelector}
          onBackToTransport={() => setLandmarkDetailsOpen(false)}
          onApply={(id) => apply.mutate(id)}
          pending={apply.isPending}
          error={actionError}
          onRunPlaceAction={(actionId) => {
            const accountId = character.data?.user_id;
            const characterId = character.data?.id;
            if (!accountId || !characterId) {
              setActionError("Player details are not ready. Reopen this place and try again.");
              return;
            }
            const requestId = getPendingMapActionKey(
              accountId,
              characterId,
              selectedLandmark.id,
              actionId,
            );
            runPlaceAction.mutate({
              accountId,
              characterId,
              landmarkId: selectedLandmark.id,
              actionId,
              requestId,
            });
          }}
          actionPending={runPlaceAction.isPending}
          actionResult={placeActionResult}
        />
      )}
    </section>
  );
}
