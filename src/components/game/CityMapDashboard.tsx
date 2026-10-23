import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff, Compass, MapPinned, Smile } from "lucide-react";
import {
  MapCanvas,
  type MapBillboardMarker,
  type MapFilter,
  type MapSearchTarget,
} from "@/components/map/MapCanvas";
import { mapHousingMarkers } from "@/components/map/map-housing-markers";
import { DistrictSheet } from "@/components/map/DistrictSheet";
import { LandmarkSheet } from "@/components/map/LandmarkSheet";
import { MapBillboardCampaignDialog } from "@/components/game/CityBillboards";
import { OsunStateOverview } from "@/components/map/OsunStateOverview";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";
import { formatMapNaira } from "@/components/map/map-ui-utils";
import townData from "@/data/osogbo-town.json";
import { q, rpc } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPendingTravelKey,
  getPendingTravelKey,
  requestMapTravel,
  requestMapPlaceAction,
  getPendingMapActionKey,
  clearPendingMapActionKey,
  type MapTravelResponse,
  requestAvailableMapLandmarks,
} from "@/lib/map-api";
import type { PlaceActionResult } from "@/components/map/PlaceActionMenu";
import { useWorldClock } from "@/hooks/use-world-clock";
import { activeCityEvents } from "@/lib/world-simulation";
import { getCurrentMapBillboards, type CurrentMapBillboard } from "@/lib/map-billboard-map";
import type { MapDistrict, MapLandmark } from "@/components/map/OsogboMap.svg";
import "@/components/map/map-ui.css";

const categories: { id: MapFilter; label: string }[] = [
  { id: "jobs", label: "Jobs" },
  { id: "food", label: "Food" },
  { id: "health", label: "Health" },
  { id: "services", label: "Services" },
  { id: "worship", label: "Worship" },
  { id: "transport", label: "Transport" },
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

export function CityMapDashboard({
  mood,
  nextRentDueAt,
}: { money?: number; mood?: string; nextRentDueAt?: string } = {}) {
  const [selectedDistrict, setSelectedDistrict] = useState<MapDistrict | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<
    (MapLandmark & { district: MapDistrict }) | null
  >(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [search, setSearch] = useState("");
  const [searchTarget, setSearchTarget] = useState<MapSearchTarget | null>(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [travelInfo, setTravelInfo] = useState<MapTravelResponse | null>(null);
  const [actionError, setActionError] = useState("");
  const [placeActionResult, setPlaceActionResult] = useState<PlaceActionResult | null>(null);
  const [selectedBillboard, setSelectedBillboard] = useState<CurrentMapBillboard | null>(null);
  const [billboardNow, setBillboardNow] = useState(() => Date.now());
  const [mapLevel, setMapLevel] = useState<"town" | "state">("town");
  const [selectedTownId, setSelectedTownId] = useState("osogbo");
  const queryClient = useQueryClient();
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
  const world = useWorldClock();
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
  const activeEvents = world.data
    ? activeCityEvents(world.data).filter((e) => e.locationSlug === selectedDistrict?.id)
    : [];
  const travel = useMutation({
    mutationFn: ({ landmarkId, idempotencyKey }: { landmarkId: string; idempotencyKey: string }) =>
      requestMapTravel(landmarkId, idempotencyKey),
    onSuccess: async (result, variables) => {
      setTravelInfo(result);
      clearPendingTravelKey(variables.idempotencyKey);
      setActionError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["character"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["worldClock"] }),
        queryClient.invalidateQueries({ queryKey: ["mapLandmarkDetails", variables.landmarkId] }),
      ]);
      window.dispatchEvent(new Event("osogbo:server-state-changed"));
    },
    onError: (e) => setActionError(e.message),
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
    }: {
      landmarkId: string;
      actionId: string;
      requestId: string;
    }) => requestMapPlaceAction(landmarkId, actionId, requestId),
    onSuccess: async (result, variables) => {
      setPlaceActionResult(result);
      setActionError("");
      clearPendingMapActionKey(variables.landmarkId, variables.actionId, variables.requestId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["character"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["worldClock"] }),
        queryClient.invalidateQueries({ queryKey: ["mapLandmarkDetails", variables.landmarkId] }),
      ]);
      window.dispatchEvent(new Event("osogbo:server-state-changed"));
    },
    onError: (error) => {
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
    },
  });
  const onDistrict = (id: string) => {
    const d = districts.find((item) => item.id === id);
    if (d) {
      setSelectedLandmark(null);
      setSelectedDistrict(d);
    }
  };
  const onLandmark = (id: string) => {
    if (!availableLandmarks.data?.includes(id)) return;
    const found = landmarks.find((item) => item.id === id);
    if (found) {
      setSelectedDistrict(null);
      setSelectedLandmark(found);
      setTravelInfo(null);
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
      <header className="map-topbar">
        <div className="map-topbar-status" aria-label="Map status">
          <span>
            <Smile size={15} aria-hidden="true" />
            <small>Mood</small>
            <strong>{displayedMood}</strong>
          </span>
          <span>
            <Compass size={15} aria-hidden="true" />
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
        </div>
        <button
          className="map-level-toggle"
          type="button"
          onClick={() => setMapLevel((level) => (level === "town" ? "state" : "town"))}
        >
          <MapPinned size={16} />
          {mapLevel === "town" ? "Explore Osun" : "Osogbo map"}
        </button>
      </header>
      {offline && (
        <div role="status" className="map-offline-banner">
          <CloudOff size={16} />
          Offline. Showing your last saved map.
        </div>
      )}
      {!offline && housingMarkers.isError && (
        <div role="status" className="map-housing-message">
          Homes could not be loaded. The town map is still available.
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
                onClick={() => setFilter(filter === c.id ? "all" : c.id)}
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
          properties={housingMarkers.data ?? []}
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
              ? { label: activeEvents[0].title, endHour: activeEvents[0].endHour }
              : null
          }
          onClose={() => setSelectedDistrict(null)}
          onLandmark={onLandmark}
        />
      )}
      {mapLevel === "town" && selectedLandmark && (
        <LandmarkSheet
          key={selectedLandmark.id}
          landmark={selectedLandmark}
          description={
            selectedLandmark.category === "worship"
              ? "This map marker is informational and is not an in-game destination."
              : `${selectedLandmark.category[0]!.toUpperCase()}${selectedLandmark.category.slice(1)} destination in ${selectedLandmark.district.name}.`
          }
          locationName={selectedLandmark.district.name}
          offline={offline}
          onClose={() => setSelectedLandmark(null)}
          onTravel={(landmarkId) => {
            const idempotencyKey = getPendingTravelKey(landmarkId);
            travel.mutate({ landmarkId, idempotencyKey });
          }}
          onApply={(id) => apply.mutate(id)}
          travelResult={travelInfo}
          pending={travel.isPending || apply.isPending}
          error={actionError}
          onRunPlaceAction={(actionId) => {
            const requestId = getPendingMapActionKey(selectedLandmark.id, actionId);
            runPlaceAction.mutate({ landmarkId: selectedLandmark.id, actionId, requestId });
          }}
          actionPending={runPlaceAction.isPending}
          actionResult={placeActionResult}
        />
      )}
    </section>
  );
}
