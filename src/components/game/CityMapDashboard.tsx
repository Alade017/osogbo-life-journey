import { transportPreference } from "@/lib/transport-park";
import "@/components/map/map-compact.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudOff, MapPinned } from "lucide-react";
import { toast } from "sonner";
import {
  MapCanvas,
  type MapBillboardMarker,
  type MapSearchTarget,
  type MapEventChip,
} from "@/components/map/MapCanvas";
import type { NeighborhoodLandmarkSpec } from "@/data/neighborhoodLocations";
import {
  enqueueNeighborhoodNavigation,
  resolvePlayerMapPosition,
  useLivePlayerPose,
} from "@/store/neighborhoodNavSync";
import { mapHousingMarkers } from "@/components/map/map-housing-markers";
import { DistrictSheet } from "@/components/map/DistrictSheet";
import { useMapTravelController } from "@/components/map/use-map-travel-controller";
import { MapTravelSelector } from "@/components/map/MapTravelSelector";
import { MapBillboardCampaignDialog } from "@/components/game/CityBillboards";
import { OsunStateOverview } from "@/components/map/OsunStateOverview";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";
import townData from "@/data/osogbo-town.json";
import { q, rpc } from "@/lib/game";
import { INITIAL_GAME_TIME, gameTimeFromCharacter } from "@/lib/game-time";
import { useWorldClock } from "@/hooks/use-world-clock";
import { supabase } from "@/integrations/supabase/client";
import {
  requestMapPlaceAction,
  getPendingMapActionKey,
  clearPendingMapActionKey,
  requestAvailableMapLandmarks,
} from "@/lib/map-api";
import type { PlaceActionResult } from "@/components/map/PlaceActionMenu";
import { useCityEvents } from "@/hooks/use-city-events";
import { overviewDistrictId, overviewDistricts as districts, overviewLandmarks as landmarks, overviewHasPlace } from "@/components/map/overview-district-routing";
import {
  getBillboardLandmarkId,
  getCurrentMapBillboards,
  isCurrentAdvertisement,
  playerCampaignAsAdvertisement,
  type CurrentMapBillboard,
} from "@/lib/map-billboard-map";
import type { MapDistrict, MapLandmark } from "@/components/map/map-types";
import "@/components/map/map-ui.css";
import "@/components/map/map-hud.css";
import "@/components/map/neighborhood-city-map.css";
import "@/components/map/map-explorer.css";

const quickTravelLandmarkDetails: Record<
  string,
  { districtId: string; label: string; category: MapLandmark["category"] }
> = {
  "olaiya-junction": {
    districtId: "olaiya",
    label: "Olaiya Junction",
    category: "junction",
  },
  "oja-oba-market": {
    districtId: "oja-oba",
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

export function CityMapDashboard(
  _props: { money?: number; mood?: string; nextRentDueAt?: string } = {},
) {
  const [selectedDistrict, setSelectedDistrict] = useState<MapDistrict | null>(null);
  const [searchTarget, setSearchTarget] = useState<MapSearchTarget | null>(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [actionError, setActionError] = useState("");
  const [placeActionResult, setPlaceActionResult] = useState<PlaceActionResult | null>(null);
  const [selectedBillboard, setSelectedBillboard] = useState<CurrentMapBillboard | null>(null);
  const [billboardNow, setBillboardNow] = useState(() => Date.now());
  const [mapLevel, setMapLevel] = useState<"town" | "state">("town");
  const [selectedTownId, setSelectedTownId] = useState("osogbo");
  const livePlayerPose = useLivePlayerPose();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mapHref = useLocation({ select: (location) => location.href });
  const preferredTransport = transportPreference(mapHref);
  useEffect(() => {
    if (preferredTransport) {
      setMapLevel("town");
    }
  }, [preferredTransport]);
  const requestedBillboardId = new URLSearchParams(mapHref.split("?")[1]?.split("#")[0] ?? "").get(
    "billboard",
  );
  const focusedBillboardId = useRef<string | null>(null);
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
  const wallet = useQuery(q.wallet());
  const worldClock = useWorldClock();
  const cityEvents = useCityEvents();
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
  const travelController = useMapTravelController<MapLandmark & { district: MapDistrict }>({
    character: character.data,
    queryClient,
    navigate,
  });
  const selectedLandmark = travelController.state.landmark;
  const selectedDestinationSlug = selectedLandmark
    ? MAP_LANDMARK_LOCATION_SLUG[selectedLandmark.id]
    : null;
  const selectedDestination = selectedDestinationSlug
    ? (locations.data?.find((row) => row.slug === selectedDestinationSlug) ?? null)
    : null;
  const currentMapPlace = currentLocation
    ? townData.landmarks.find(
        (place) => MAP_LANDMARK_LOCATION_SLUG[place.id] === currentLocation.slug,
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
  useEffect(() => {
    if (
      !requestedBillboardId ||
      !billboards.data ||
      !locations.data ||
      !advertisements.data ||
      !playerAdvertisements.data
    )
      return;
    if (focusedBillboardId.current === requestedBillboardId) return;
    const board = billboards.data.find((item) => item.id === requestedBillboardId);
    if (!board) return;
    const landmarkId = getBillboardLandmarkId(board.location_id, locations.data);
    if (!landmarkId) return;
    focusedBillboardId.current = requestedBillboardId;
    setMapLevel("town");
    setSearchTarget({ id: landmarkId, kind: "landmark" });
    const campaign = [
      ...advertisements.data,
      ...playerAdvertisements.data.map(playerCampaignAsAdvertisement),
    ].find((ad) => ad.billboard_id === board.id && isCurrentAdvertisement(ad, Date.now()));
    setSelectedBillboard(
      campaign ? { landmarkId, count: 1, billboard: board, advertisement: campaign } : null,
    );
  }, [
    requestedBillboardId,
    billboards.data,
    locations.data,
    advertisements.data,
    playerAdvertisements.data,
  ]);
  const activeEvents = cityEvents.isError
    ? []
    : (cityEvents.data?.events ?? []).filter(event => event.status === "active" && selectedDistrict && overviewDistrictId(event.districtId, event.landmarkId) === selectedDistrict.id);
  const eventChips: MapEventChip[] = (cityEvents.data?.events ?? [])
    .filter((event) => event.status === "active")
    .flatMap((event) => {
      const landmark = townData.landmarks.find((place) => place.id === event.landmarkId && overviewHasPlace(place.id));
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
  const closeTravelSelector = travelController.close;
  const selectDestination = travelController.select;
  const selectPreferredMode = travelController.selectMode;
  const setDestinationTab = travelController.setTab;
  const onDistrict = (id: string) => {
    if (travelController.busy || travelController.arrivalConfirmed) return;
    const district = districts.find((item) => item.id === overviewDistrictId(id));
    if (district) {
      travelController.close();
      setSelectedDistrict(district);
    }
  };
  const onLandmark = useCallback(
    (id: string) => {
      if (!availableLandmarks.data?.includes(id)) return;

      const found = landmarks.find((item) => item.id === id) ?? getQuickTravelLandmark(id);

      if (found) {
        setSelectedDistrict(null);
        selectDestination(found);
        if (preferredTransport) selectPreferredMode(preferredTransport);
        setActionError("");
        setPlaceActionResult(null);
      }
    },
    [availableLandmarks.data, selectDestination, preferredTransport, selectPreferredMode],
  );
  const deepLinkedLandmark = useRef<string | null>(null);
  useEffect(() => {
    if (!availableLandmarks.data) return;
    const params = new URLSearchParams(window.location.search);
    const landmarkId = params.get("landmark");
    if (!landmarkId || params.get("details") !== "1" || deepLinkedLandmark.current === landmarkId)
      return;
    if (!availableLandmarks.data.includes(landmarkId)) return;
    deepLinkedLandmark.current = landmarkId;
    onLandmark(landmarkId);
    setDestinationTab("details");
    params.delete("landmark");
    params.delete("details");
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      query ? "?" + query : window.location.pathname,
    );
  }, [availableLandmarks.data, onLandmark, setDestinationTab]);
  const playerMapPosition = useMemo(
    () => resolvePlayerMapPosition(character.data, livePlayerPose),
    [character.data, livePlayerPose],
  );

  const effectivePocketBalance = useMemo(() => {
    if (typeof wallet.data?.balance === "number") return wallet.data.balance;
    return 0;
  }, [wallet.data?.balance]);

  return (
    <section className="city-map-dashboard is-world-map map-experience" aria-label="Osun Life map">
      <header className="map-hud map-hud-minimal">
        <div className="map-hud-actions">
          <button
            className="map-level-toggle"
            type="button"
            onClick={() => setMapLevel((level) => (level === "town" ? "state" : "town"))}
          >
            <MapPinned size={16} aria-hidden="true" />
            {mapLevel === "town" ? "Explore Osun" : "Osogbo map"}
          </button>
        </div>
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
      {mapLevel === "town" ? (
        <div className="ncm-layout-grid">
          <div className="ncm-3d-companion">
            <div className="ncm-3d-companion-bar">
              <div>
                <strong>Places &amp; districts</strong>{" "}
                <span>Pick a place, then walk its streets</span>
              </div>
              <button
                type="button"
                className="ncm-3d-expand-btn"
                onClick={() => void navigate({ to: "/neighborhood" })}
              >
                Walk the streets
              </button>
            </div>
            <MapCanvas
              selectedLandmarkId={selectedLandmark?.id ?? null}
              travelMode={travelController.state.mode}
              travelPending={travelController.state.phase === "submitting"}
              playerLocation={
                currentMapPlace
                  ? {
                      x:
                        currentLocation?.slug === "city-centre"
                          ? currentMapPlace.grid.x + (playerMapPosition.mapCoords.x - 0.5) * 2.2
                          : currentMapPlace.grid.x,
                      y:
                        currentLocation?.slug === "city-centre"
                          ? currentMapPlace.grid.z + (playerMapPosition.mapCoords.y - 0.5) * 1.4
                          : currentMapPlace.grid.z,
                      label: "You are here",
                    }
                  : null
              }
              properties={housingMarkers.data ?? []}
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
                travelController.select(found, "details");
                setActionError("");
                setPlaceActionResult(null);
              }}
              availableLandmarkIds={availableLandmarks.data ?? []}
              onSelectDistrict={onDistrict}
              onSelectLandmark={onLandmark}
              searchTarget={searchTarget}
              billboardMarkers={billboardMarkers}
              onSelectBillboard={(campaignId) => {
                setSelectedBillboard(
                  activeMapBillboards.find(
                    ({ advertisement }) => advertisement.id === campaignId,
                  ) ?? null,
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
          </div>
        </div>
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
      {mapLevel === "town" && selectedLandmark && (
        <MapTravelSelector
          open
          landmark={selectedLandmark}
          districtName={selectedLandmark.district.name}
          accountId={character.data?.user_id}
          characterId={character.data?.id}
          destination={selectedDestination}
          isLoadingDestination={locations.isLoading}
          destinationLoadError={locations.isError}
          onRetryDestination={() => void locations.refetch()}
          originName={currentLocation?.name ?? "Current location"}
          currentLocationId={character.data?.current_location_id ?? null}
          characterLevel={character.data?.level ?? null}
          walletBalance={wallet.data?.balance ?? null}
          walletLoading={wallet.isLoading}
          onRetryWallet={() => void wallet.refetch()}
          gameTime={
            worldClock.data ??
            (character.data ? gameTimeFromCharacter(character.data) : INITIAL_GAME_TIME)
          }
          offline={offline}
          state={travelController.state}
          onTabChange={travelController.setTab}
          onModeChange={travelController.selectMode}
          onConfirm={(mode) => {
            if (selectedDestination) void travelController.confirm(selectedDestination.id, mode);
          }}
          onCancel={closeTravelSelector}
          onRetryArrival={() => void travelController.retryArrival()}
          detailsProps={{
            description:
              selectedLandmark.category === "worship"
                ? "This map marker is informational and is not an in-game destination."
                : `${selectedLandmark.category[0]!.toUpperCase()}${selectedLandmark.category.slice(1)} destination in ${selectedLandmark.district.name}.`,
            locationName: selectedLandmark.district.name,
            event: landmarkEvent
              ? { label: landmarkEvent.title, endsAt: landmarkEvent.endsAt }
              : null,
            onApply: (id) => apply.mutate(id),
            pending: apply.isPending,
            error: actionError,
            onRunPlaceAction: (actionId) => {
              const accountId = character.data?.user_id,
                characterId = character.data?.id;
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
            },
            actionPending: runPlaceAction.isPending,
            actionResult: placeActionResult,
          }}
        />
      )}
    </section>
  );
}
