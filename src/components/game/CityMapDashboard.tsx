import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CalendarDays, CloudOff, Compass, Smile } from "lucide-react";
import { MapCanvas, type MapFilter, type MapSearchTarget } from "@/components/map/MapCanvas";
import { DistrictSheet } from "@/components/map/DistrictSheet";
import { LandmarkSheet } from "@/components/map/LandmarkSheet";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";
import { formatMapNaira } from "@/components/map/map-ui-utils";
import mapData from "@/data/osogbo-map.json";
import { formatNaira, q, rpc } from "@/lib/game";
import {
  clearPendingTravelKey,
  getPendingTravelKey,
  requestMapTravel,
  type MapTravelResponse,
} from "@/lib/map-api";
import { useWorldClock } from "@/hooks/use-world-clock";
import { activeCityEvents } from "@/lib/world-simulation";
import { formatCalendarDate, lagosDateKey, upcomingCalendarEvents } from "@/lib/osogbo-calendar";
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
const districts = mapData.districts as MapDistrict[];
const landmarks = districts.flatMap((d) => d.landmarks.map((l) => ({ ...l, district: d })));

export function CityMapDashboard({
  money,
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
  const queryClient = useQueryClient();
  const character = useQuery(q.character());
  const wallet = useQuery(q.wallet());
  const rent = useQuery(q.rentStatus());
  const world = useWorldClock();
  const jobCatalog = useQuery({ ...q.jobs(), enabled: filter === "jobs" });
  const locations = useQuery({ ...q.locations(), enabled: filter === "jobs" });
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const activeEvents = world.data
    ? activeCityEvents(world.data).filter((e) => e.locationSlug === selectedDistrict?.id)
    : [];
  const nextRealEvent = upcomingCalendarEvents(lagosDateKey(), 1)[0] ?? null;
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
      ]);
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
  const onDistrict = (id: string) => {
    const d = districts.find((item) => item.id === id);
    if (d) {
      setSelectedLandmark(null);
      setSelectedDistrict(d);
    }
  };
  const onLandmark = (id: string) => {
    const found = landmarks.find((item) => item.id === id);
    if (found) {
      setSelectedDistrict(null);
      setSelectedLandmark(found);
      setTravelInfo(null);
      setActionError("");
    }
  };
  const searchMatches = useMemo(() => {
    const value = search.trim().toLocaleLowerCase();
    if (!value) return null;
    return (
      [
        ...districts.map((d) => ({ id: d.id, kind: "district" as const, label: d.name })),
        ...landmarks.map((l) => ({ id: l.id, kind: "landmark" as const, label: l.label })),
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
  }, [search]);
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
    <section
      className="city-map-dashboard is-world-map map-experience"
      aria-label="Osogbo district map"
    >
      <header className="map-topbar">
        <span>
          <Banknote size={16} />
          {formatNaira(money ?? wallet.data?.balance ?? 0)}
        </span>
        <span>
          <Smile size={16} />
          {displayedMood}
        </span>
        <span>
          <Compass size={16} />
          {due
            ? `Rent due ${new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }).format(new Date(due))}`
            : "Rent schedule unavailable"}
        </span>
        {nextRealEvent && (
          <span>
            <CalendarDays size={16} />
            Next: {nextRealEvent.title} · {formatCalendarDate(nextRealEvent.startsOn)}
          </span>
        )}
      </header>
      {offline && (
        <div role="status" className="map-offline-banner">
          <CloudOff size={16} />
          Offline. Showing your last saved map.
        </div>
      )}
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
      <MapCanvas
        onSelectDistrict={onDistrict}
        onSelectLandmark={onLandmark}
        activeFilter={filter}
        searchTarget={searchTarget}
        jobLandmarkIds={jobLandmarkIds}
      />
      {selectedDistrict && (
        <DistrictSheet
          district={selectedDistrict}
          event={
            activeEvents[0]
              ? { label: activeEvents[0].title, endHour: activeEvents[0].endHour }
              : null
          }
          onClose={() => setSelectedDistrict(null)}
          onLandmark={onLandmark}
        />
      )}
      {selectedLandmark && (
        <LandmarkSheet
          landmark={selectedLandmark}
          description={
            selectedLandmark.category === "worship"
              ? "This map marker is informational and is not an in-game destination."
              : `${selectedLandmark.category[0]!.toUpperCase()}${selectedLandmark.category.slice(1)} destination in ${selectedLandmark.district.name}.`
          }
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
        />
      )}
    </section>
  );
}
