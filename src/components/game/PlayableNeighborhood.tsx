import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { HomeLink } from "@/components/game/HomeLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  DoorOpen,
  Home,
  Landmark,
  Map,
  MessageCircle,
  Minus,
  Plus,
  Store,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  beginTransition,
  completeTransitionStep,
  currentTransitionKind,
  endTransition,
  useOutsideTransition,
} from "@/lib/outside-transition";
import { PhoneBankApp } from "@/components/game/phone/PhoneBankApp";
import { LocationVenueScene } from "@/components/game/LocationVenueScene";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";
import { NeighborhoodZoneModal } from "@/components/game/NeighborhoodZoneModal";
import { GROUND_ARRIVE_DISTANCE, groundIntent } from "@/game/ground-intent";
import { commuteNotice } from "@/game/commute-notice";
import "./commute-banner.css";
import { joinNeighborhood, type NeighborhoodRoom } from "@/lib/multiplayer-service";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import { canonicalHomeOptions } from "@/lib/living-cost-service";
import { useGameTime } from "@/components/game/GameTimeProvider";
import type { NetworkPlayerSnapshot } from "@/game/multiplayer-state";
import { avatarAnimationForActivity } from "@/game/character-animation";
import { buildMinimapTelemetry } from "@/game/neighborhood-minimap";
import { NeighborhoodMinimap } from "./NeighborhoodMinimap";
import {
  neighborhoodAreaForSlug,
  neighborhoodSceneBounds,
  nearestInteraction,
  toScene,
  toWorld,
  type NeighborhoodNpcView,
  type WorldPoint,
} from "@/game/neighborhood-model";
import { commuteIntent, planCommuteRoute } from "@/game/commute-route";
import { scenePointToThreeXZ } from "@/data/neighborhoodLocations";
import { consumeNeighborhoodNavigation, publishLivePlayerPose } from "@/store/neighborhoodNavSync";
import {
  findInteractableZone,
  findZoneNpc,
  NEIGHBORHOOD_ZONE_NPCS,
  nearestInteractableZone,
  nearestZoneNpc,
  type InteractableZoneSpec,
  type ZoneActionOutcome,
  type ZoneNpcSpec,
} from "@/game/neighborhood-interactions";
import {
  applyZoneOutcomeAction,
  closeZoneInteraction,
  effectiveNeedsFromCharacter,
  equipLocalAccessoryAction,
  loadPersistedNeighborhoodState,
  neighborhoodReducer,
  openZoneInteraction,
  persistNeighborhoodState,
  recordNpcChatAction,
  setHoveredZoneId,
  setPendingZoneId,
  syncNpcChatToQueryCache,
  syncZoneOutcomeToQueryCache,
} from "@/store/neighborhoodSlice";
import { isPlayableDistrict, playableDistrictForLocation } from "@/game/playable-district";
import type { NeighborhoodPlayerView, NeighborhoodSceneHandle } from "@/game/neighborhood-types";
import type { MovementDirection } from "@/lib/player-movement";
import { NPC_CATALOG, npcActivityAt, type SocialAction } from "@/lib/npc-simulation";
import { hasBuildingVenueInterior, hasLocationVenueDesign } from "@/lib/location-venue-designs";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";
import { JobsPage } from "@/routes/_authenticated/_game/jobs";
import { MarketPage } from "@/routes/_authenticated/_game/market";
import { NEIGHBORHOOD_CAMERA } from "@/components/3d/world-theme";
import "@/components/game/neighborhood.css";

const R3FNeighborhoodSurface = lazy(() =>
  import("./R3FNeighborhoodSurface").then((module) => ({ default: module.R3FNeighborhoodSurface })),
);
const BUSINESS_PLACE_CATEGORIES = new Set([
  "market",
  "supermarket",
  "food-market",
  "electronics",
  "phone-store",
  "clothing",
]);

type ConnectionState = "loading" | "connecting" | "connected" | "unavailable" | "wrong-area";
type InteractionPanel = "business" | "work" | "npc";
type BusinessView = "actions" | "interior" | "shops" | "bank";
const NEIGHBORHOOD_JOIN_TIMEOUT_MS = 15_000;
const NEIGHBORHOOD_STATE_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function playerViewsFromRoom(room: NeighborhoodRoom): NeighborhoodPlayerView[] | null {
  // joinOrCreate may resolve before the first authoritative state message.
  if (!room.state?.players || typeof room.state.players.forEach !== "function") return null;
  const players: NeighborhoodPlayerView[] = [];
  room.state.players.forEach((player: NetworkPlayerSnapshot, sessionId: string) => {
    players.push({
      sessionId,
      characterId: player.characterId,
      name: player.name,
      gender: player.gender,
      appearance: player.appearance,
      equipment: player.equipment,
      x: player.x,
      y: player.y,
      facing: player.facing,
    });
  });
  return players;
}

function useNeighborhoodConnection(
  locationId: string | undefined,
  slug: string | undefined,
  locationIsPlayable: boolean,
  attempt: number,
  setAttempt: (update: (attempt: number) => number) => void,
  onCommuteState: (message: unknown) => void,
) {
  const commuteHandler = useRef(onCommuteState);
  commuteHandler.current = onCommuteState;
  const [connectionState, setConnectionState] = useState<ConnectionState>("loading");
  const [players, setPlayers] = useState<NeighborhoodPlayerView[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roomLocationId, setRoomLocationId] = useState<string | null>(null);
  const roomRef = useRef<NeighborhoodRoom | null>(null);

  useEffect(() => {
    setPlayers([]);
    setSessionId(null);
    setRoomLocationId(null);
    if (!locationId || !slug) {
      setConnectionState("unavailable");
      return;
    }
    if (!locationIsPlayable || !isPlayableDistrict(slug)) {
      setConnectionState("wrong-area");
      setPlayers([]);
      setSessionId(null);
      return;
    }

    let active = true;
    let joinTimedOut = false;
    let roomEnded = false;
    let joinedRoom: NeighborhoodRoom | null = null;
    let joinTimeout = 0;
    let stateTimeout = 0;
    let retryTimeout = 0;
    const scheduleRetry = () => {
      if (!active || retryTimeout) return;
      const delay = Math.min(30_000, 1_500 * 2 ** Math.min(attempt, 4));
      retryTimeout = window.setTimeout(() => {
        retryTimeout = 0;
        if (active) setAttempt((current) => current + 1);
      }, delay);
    };
    setConnectionState("connecting");

    joinTimeout = window.setTimeout(() => {
      if (!active) return;
      joinTimedOut = true;
      setConnectionState("unavailable");
      scheduleRetry();
    }, NEIGHBORHOOD_JOIN_TIMEOUT_MS);

    void joinNeighborhood(locationId)
      .then((room) => {
        window.clearTimeout(joinTimeout);
        if (!active || joinTimedOut) {
          void room
            .leave()
            .catch((error: unknown) =>
              console.error("Could not close the neighborhood room.", error),
            );
          return;
        }
        joinedRoom = room;
        roomRef.current = room;
        room.onMessage("commute-state", (message: unknown) => commuteHandler.current(message));
        setSessionId(room.sessionId);
        setRoomLocationId(locationId);
        const publish = () => {
          if (!active) return;
          const snapshot = playerViewsFromRoom(room);
          if (!snapshot || roomEnded) return false;
          window.clearTimeout(stateTimeout);
          setPlayers(snapshot);
          setConnectionState("connected");
          return true;
        };
        room.onStateChange(publish);
        room.onLeave(() => {
          if (!active || roomEnded) return;
          roomEnded = true;
          window.clearTimeout(stateTimeout);
          roomRef.current = null;
          joinedRoom = null;
          setPlayers([]);
          setConnectionState("unavailable");
          scheduleRetry();
        });
        if (!publish()) {
          stateTimeout = window.setTimeout(() => {
            if (!active || roomEnded) return;
            roomEnded = true;
            roomRef.current = null;
            joinedRoom = null;
            setConnectionState("unavailable");
            scheduleRetry();
            void room
              .leave()
              .catch((error: unknown) =>
                console.error("Could not close the neighborhood room.", error),
              );
          }, NEIGHBORHOOD_STATE_TIMEOUT_MS);
        }
      })
      .catch(() => {
        if (!active || joinTimedOut) return;
        window.clearTimeout(joinTimeout);
        const failedRoom = joinedRoom;
        joinedRoom = null;
        roomRef.current = null;
        if (failedRoom) {
          void failedRoom
            .leave()
            .catch((leaveError: unknown) =>
              console.error("Could not close the neighborhood room.", leaveError),
            );
        }
        setConnectionState("unavailable");
        scheduleRetry();
      });

    return () => {
      active = false;
      window.clearTimeout(joinTimeout);
      window.clearTimeout(stateTimeout);
      window.clearTimeout(retryTimeout);
      roomRef.current = null;
      if (joinedRoom) {
        void joinedRoom
          .leave()
          .catch((error: unknown) =>
            console.error("Could not close the neighborhood room.", error),
          );
      }
    };
  }, [attempt, locationId, locationIsPlayable, slug]);

  const sameLocation = roomLocationId === locationId;
  return {
    connectionState:
      !sameLocation && connectionState === "connected" ? ("connecting" as const) : connectionState,
    players: sameLocation ? players : [],
    sessionId: sameLocation ? sessionId : null,
    roomRef,
  };
}

function directionIntent(directions: ReadonlySet<MovementDirection>) {
  return {
    x: Number(directions.has("east")) - Number(directions.has("west")),
    y: Number(directions.has("south")) - Number(directions.has("north")),
  };
}

/** Keyboard keys that walk the character. Taps and clicks on the ground use the same intent. */
const KEY_DIRECTIONS: Readonly<Record<string, MovementDirection>> = {
  ArrowUp: "north",
  KeyW: "north",
  ArrowDown: "south",
  KeyS: "south",
  ArrowLeft: "west",
  KeyA: "west",
  ArrowRight: "east",
  KeyD: "east",
};

function homeTypeFromRecord(value: unknown) {
  if (!isRecord(value) || typeof value["houseTypeId"] !== "string") return null;
  return value["houseTypeId"];
}

export function PlayableNeighborhood() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { simulation } = useGameTime();
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  // The neighbourhood is a game viewport, not a document section. Prevent the browser
  // page from scrolling while this route is mounted, then restore the previous shell state.
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const previous = {
      bodyOverflow: body.style.overflow,
      rootOverflow: root.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      rootOverscroll: root.style.overscrollBehavior,
    };
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    root.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = previous.bodyOverflow;
      root.style.overflow = previous.rootOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      root.style.overscrollBehavior = previous.rootOverscroll;
    };
  }, []);
  const characterQuery = useQuery(q.character());
  const walletQuery = useQuery(q.wallet());
  const locationsQuery = useQuery({
    ...q.locations(),
    enabled: !!characterQuery.data?.current_location_id,
  });
  const currentLocation = locationsQuery.data?.find(
    (location) => location.id === characterQuery.data?.current_location_id,
  );
  const district = useMemo(() => playableDistrictForLocation(currentLocation), [currentLocation]);
  const area = district?.area ?? neighborhoodAreaForSlug("city-centre");
  const homeQuery = useQuery({
    ...canonicalHomeOptions(characterQuery.data?.id),
    enabled: !!characterQuery.data?.id && currentLocation?.slug === "city-centre",
  });
  const homeTypeId = district?.personalHome ? homeTypeFromRecord(homeQuery.data) : null;
  const npcQuery = useQuery({ ...q.npcs(), enabled: !!currentLocation?.id });
  const placesQuery = useQuery({ ...q.places(), enabled: !!currentLocation?.id });
  const shopItemsQuery = useQuery({ ...q.shopItems(), enabled: !!currentLocation?.id });
  const jobsQuery = useQuery({ ...q.jobs(), enabled: !!currentLocation?.id });
  const [commuting, setCommuting] = useState(false);
  const { connectionState, players, sessionId, roomRef } = useNeighborhoodConnection(
    currentLocation?.id,
    currentLocation?.slug,
    district !== null,
    connectionAttempt,
    setConnectionAttempt,
    (message) => {
      const notice = commuteNotice(message);
      if (!notice) return;
      setCommuting(notice.heading);
      if (notice.toast) toast[notice.toast.kind](notice.toast.text);
      if (notice.openWork) {
        setWorkView("actions");
        setActivePanel("work");
      }
    },
  );
  const [directions, setDirections] = useState<ReadonlySet<MovementDirection>>(() => new Set());
  const [groundTarget, setGroundTarget] = useState<{ x: number; y: number } | null>(null);
  const groundTargetRef = useRef(groundTarget);
  groundTargetRef.current = groundTarget;
  const transition = useOutsideTransition();
  const leavingStepsRef = useRef({ data: false, scene: false });
  const [scene, setScene] = useState<NeighborhoodSceneHandle | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [zoom, setZoom] = useState<number>(NEIGHBORHOOD_CAMERA.defaultZoom);
  const directionsRef = useRef(directions);
  directionsRef.current = directions;
  const lastIntentRef = useRef("0:0");
  const [activePanel, setActivePanel] = useState<InteractionPanel | null>(null);
  const [selectedBuildingName, setSelectedBuildingName] = useState<string | null>(null);
  const [selectedShopSlug, setSelectedShopSlug] = useState<string | null | undefined>(undefined);
  /** A tapped building or person the character is walking to; interaction opens on arrival. */
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  /** Set while the character walks to its home door after Go home. */
  const [homeBound, setHomeBound] = useState(false);
  const [businessView, setBusinessView] = useState<BusinessView>("actions");
  const [workView, setWorkView] = useState<"actions" | "interior">("actions");
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [npcDialogue, setNpcDialogue] = useState<string | null>(null);
  const [npcPositionOverrides, setNpcPositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [zoneState, dispatchZone] = useReducer(
    neighborhoodReducer,
    undefined,
    loadPersistedNeighborhoodState,
  );
  const [hasWalked, setHasWalked] = useState(false);
  const autoWalkRouteRef = useRef<{ route: WorldPoint[]; index: number } | null>(null);
  const zoneModalOpen = zoneState.activeZoneId !== null || zoneState.activeNpcId !== null;
  const anyModalOpen = activePanel !== null || zoneModalOpen;
  const player = players.find((candidate) => candidate.sessionId === sessionId);
  const playerRef = useRef(player);
  playerRef.current = player;

  const startPathfindingTo = useCallback(
    (targetScenePoint: WorldPoint) => {
      const currentPlayer = playerRef.current;
      if (currentPlayer && district) {
        const plannedRoute = planCommuteRoute(
          { x: currentPlayer.x, y: currentPlayer.y },
          targetScenePoint,
          district.origin,
          area.objects,
          area.obstacles,
        );
        autoWalkRouteRef.current =
          plannedRoute && plannedRoute.length > 0 ? { route: plannedRoute, index: 0 } : null;
      } else {
        autoWalkRouteRef.current = null;
      }
      setHasWalked(true);
      setDirections(new Set());
      setGroundTarget(targetScenePoint);
    },
    [area.objects, area.obstacles, district],
  );

  useEffect(() => {
    persistNeighborhoodState(zoneState);
  }, [zoneState]);

  useEffect(() => {
    if (!player || !district) return;
    const scenePoint = toScene({ x: player.x, y: player.y }, district.origin);
    const [threeX, threeZ] = scenePointToThreeXZ(scenePoint);
    publishLivePlayerPose({
      worldX: player.x,
      worldY: player.y,
      sceneX: scenePoint.x,
      sceneY: scenePoint.y,
      threeX,
      threeZ,
      locationSlug: currentLocation?.slug ?? "city-centre",
      updatedAt: Date.now(),
    });
  }, [currentLocation?.slug, district, player]);
  // Neighbourhood checkpoints are saved by the multiplayer server, not by the browser.
  const actionAnimation = simulation.currentAction
    ? avatarAnimationForActivity(simulation.currentAction.animation)
    : undefined;
  const minimapTelemetry = useMemo(() => {
    if (!district) return null;
    const origin = district.origin;
    const self = players.find((candidate) => candidate.sessionId === sessionId);
    return buildMinimapTelemetry({
      bounds: neighborhoodSceneBounds(origin),
      self: self ? toScene(self, origin) : null,
      others: players
        .filter((candidate) => candidate.sessionId !== sessionId)
        .map((candidate) => toScene(candidate, origin)),
      target: groundTarget,
    });
  }, [district, groundTarget, players, sessionId]);
  const scenePlayers = useMemo(
    () =>
      players.map((candidate) => {
        if (candidate.sessionId !== sessionId) return candidate;
        let nextEquipment = candidate.equipment;
        if (zoneState.equippedAccessorySlug) {
          try {
            const parsed = JSON.parse(candidate.equipment || "[]");
            const arr = Array.isArray(parsed)
              ? parsed.filter((entry) => entry?.slot !== "accessory")
              : [];
            arr.push({ slot: "accessory", item: { slug: zoneState.equippedAccessorySlug } });
            nextEquipment = JSON.stringify(arr);
          } catch {
            nextEquipment = JSON.stringify([
              { slot: "accessory", item: { slug: zoneState.equippedAccessorySlug } },
            ]);
          }
        }
        return {
          ...candidate,
          equipment: nextEquipment,
          ...(actionAnimation ? { actionAnimation } : {}),
        };
      }),
    [actionAnimation, players, sessionId, zoneState.equippedAccessorySlug],
  );
  useEffect(() => setNpcPositionOverrides({}), [currentLocation?.id]);
  const activeNpcs = useMemo((): NeighborhoodNpcView[] => {
    if (!currentLocation || !npcQuery.data || !locationsQuery.data) return [];
    const savedNpcIds = new Set(npcQuery.data.map((npc) => npc.id));
    const slots = area.objects.filter((object) => object.kind === "npc");
    const scheduled = NPC_CATALOG.flatMap((npc) => {
      if (!savedNpcIds.has(npc.id)) return [];
      const activity = npcActivityAt(
        npc,
        simulation.gameTime,
        (slug) => locationsQuery.data?.find((location) => location.slug === slug)?.id ?? null,
      );
      return activity.destinationSlug === currentLocation.slug ? [{ npc, activity }] : [];
    }).slice(0, slots.length);
    return scheduled.map(({ npc, activity }, index) => {
      const slot = slots[index]!;
      const destinationObject =
        activity.destination === "home"
          ? area.objects.find((object) => object.kind === "home")
          : activity.destination === "work"
            ? area.objects.find((object) => object.kind === "work")
            : activity.destination === "market"
              ? area.objects.find((object) => object.kind === "market")
              : (area.obstacles?.find((obstacle) => obstacle.kind === "bench") ??
                area.objects.find((object) => object.kind === "market"));
      const spread = (index - (scheduled.length - 1) / 2) * 34;
      const targetX = (destinationObject?.x ?? slot.x) + spread;
      const targetY = (destinationObject?.y ?? slot.y) + (index % 2 === 0 ? 34 : -34);
      const current = npcPositionOverrides[npc.id] ?? { x: slot.x, y: slot.y };
      const isMoving =
        !simulation.paused && Math.hypot(targetX - current.x, targetY - current.y) > 2;
      const activityKind = isMoving
        ? "walking"
        : activity.destination === "work"
          ? "working"
          : activity.destination === "market"
            ? "shopping"
            : activity.destination === "park"
              ? "socializing"
              : activity.label.toLowerCase().includes("sleep")
                ? "sleeping"
                : "resting";
      return {
        id: npc.id,
        name: npc.name,
        role: npc.role,
        activity: activity.label,
        available: activity.available,
        isPaused: simulation.paused,
        activityKind,
        x: current.x,
        y: current.y,
        targetX,
        targetY,
        isMoving,
      };
    });
  }, [
    area.objects,
    area.obstacles,
    currentLocation,
    locationsQuery.data,
    npcPositionOverrides,
    npcQuery.data,
    simulation.gameTime,
    simulation.paused,
  ]);
  const localPlaces =
    placesQuery.data?.filter((place) => place.location_id === currentLocation?.id) ?? [];
  const hasShopOffers =
    shopItemsQuery.data?.some((offer) => offer.shop?.location_id === currentLocation?.id) ?? false;
  const hasSelectedShopOffers =
    selectedShopSlug === undefined
      ? hasShopOffers
      : selectedShopSlug !== null &&
        (shopItemsQuery.data?.some(
          (offer) =>
            offer.shop?.location_id === currentLocation?.id && offer.shop.slug === selectedShopSlug,
        ) ??
          false);
  const hasBankServices =
    currentLocation?.type === "bank" ||
    localPlaces.some((place) => place.category === "bank" || place.category === "atm");
  const hasCareerServices =
    jobsQuery.data?.some((job) => job.is_available && job.location_id === currentLocation?.id) ??
    false;
  const hasVenueInterior = currentLocation ? hasLocationVenueDesign(currentLocation.slug) : false;
  const hasSelectedVenueInterior = currentLocation
    ? hasBuildingVenueInterior(currentLocation.slug, selectedShopSlug)
    : false;
  const activityLandmarkId = Object.entries(MAP_LANDMARK_LOCATION_SLUG).find(
    ([, slug]) => !!slug && slug === currentLocation?.slug,
  )?.[0];
  const hasLocalBusinesses = localPlaces.some((place) =>
    BUSINESS_PLACE_CATEGORIES.has(place.category),
  );
  const interactionTargets = useMemo(() => {
    const buildings = area.objects.filter((object) => {
      if (object.kind === "home") return !!district?.personalHome && !!homeTypeId;
      if (object.kind === "market")
        return hasShopOffers || hasLocalBusinesses || hasBankServices || hasVenueInterior;
      if (object.kind === "work") return hasCareerServices;
      return false;
    });
    const npcTargets = activeNpcs
      .filter((npc) => npc.available && !npc.isMoving)
      .map((npc): (typeof area.objects)[number] => ({
        id: npc.id,
        name: npc.name,
        kind: "npc",
        x: npc.x,
        y: npc.y,
      }));
    return [...buildings, ...npcTargets];
  }, [
    activeNpcs,
    area,
    district?.personalHome,
    hasBankServices,
    hasCareerServices,
    hasLocalBusinesses,
    hasShopOffers,
    hasVenueInterior,
    homeTypeId,
  ]);
  const playerScenePoint = useMemo(() => {
    if (!player || !district) return null;
    return toScene({ x: player.x, y: player.y }, district.origin);
  }, [district, player]);
  const zoneNpcs = useMemo(
    () => (area.zoneLayout ? NEIGHBORHOOD_ZONE_NPCS : []),
    [area.zoneLayout],
  );
  const nearbyZoneMatch = useMemo(() => {
    if (!area.zoneLayout || !playerScenePoint) return null;
    return nearestInteractableZone(playerScenePoint);
  }, [area.zoneLayout, playerScenePoint]);
  const nearbyZoneNpcMatch = useMemo(() => {
    if (!area.zoneLayout || !playerScenePoint) return null;
    return nearestZoneNpc(playerScenePoint, zoneNpcs);
  }, [area.zoneLayout, playerScenePoint, zoneNpcs]);
  const nearbyObject = useMemo(() => {
    if (!playerScenePoint) return null;
    return nearestInteraction(playerScenePoint, interactionTargets);
  }, [interactionTargets, playerScenePoint]);
  const nearbyNpc =
    nearbyObject?.kind === "npc"
      ? (activeNpcs.find((npc) => npc.id === nearbyObject.id) ?? null)
      : null;
  const selectedNpc = activeNpcs.find((npc) => npc.id === selectedNpcId) ?? nearbyNpc;
  const npcInteraction = useGameAction(rpc.interactWithNpc, {
    onSuccess: (result) => {
      setNpcDialogue(result.message);
      toast[result.accepted ? "success" : "message"](result.message);
    },
  });

  const enterHome = useMutation({
    onMutate: () => beginTransition("entering", "Heading to your door", 3),
    mutationFn: async () => {
      if (!district?.personalHome || !homeTypeId)
        throw new Error("Your home entrance is available in Olaiya.");
      const { data, error } = await supabase.rpc("enter_player_home");
      if (error) throw new Error(error.message);
      if (!isRecord(data) || typeof data["locationId"] !== "string")
        throw new Error("The server did not confirm your home. Try again.");
      return data;
    },
    onSuccess: async () => {
      const room = roomRef.current;
      room?.send("move", { x: 0, y: 0 });
      completeTransitionStep("Going inside");
      await queryClient.invalidateQueries({ queryKey: q.character().queryKey });
      await navigate({ to: "/house" });
    },
    onError: () => endTransition(),
  });
  /** Go home walks the character to the home door first; entry starts only on arrival. */
  const homeObject = area.objects.find((object) => object.kind === "home");
  const enterHomeNow = enterHome.mutate;
  const nearHome = nearbyObject?.kind === "home";
  const activateHome = useCallback(() => {
    if (nearHome || !homeObject || !district?.personalHome) {
      enterHomeNow();
      return;
    }
    startPathfindingTo({ x: homeObject.x, y: homeObject.y });
    setHomeBound(true);
  }, [nearHome, homeObject, district?.personalHome, enterHomeNow, startPathfindingTo]);
  const enteringHome = enterHome.isPending;
  useEffect(() => {
    if (!homeBound || nearbyObject?.kind !== "home") return;
    setHomeBound(false);
    enterHome.mutate();
    // enterHome is stable for this render; the effect only reacts to arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeBound, nearbyObject]);

  useEffect(() => {
    setDirections(new Set());
    lastIntentRef.current = "0:0";
    setZoom(NEIGHBORHOOD_CAMERA.defaultZoom);
    setActivePanel(null);
    setSelectedBuildingName(null);
    setSelectedShopSlug(undefined);
    setBusinessView("actions");
    setWorkView("actions");
    setSelectedNpcId(null);
    setNpcDialogue(null);
  }, [currentLocation?.id]);

  /** Career shifts ask the server to walk the character to work from this neighbourhood. */
  useEffect(() => {
    const requestCommute = (event: Event) => {
      const shiftId = (event as CustomEvent<{ shiftId?: unknown }>).detail?.shiftId;
      if (typeof shiftId === "string") roomRef.current?.send("commute-to-work", { shiftId });
    };
    window.addEventListener("osun:commute-to-work", requestCommute);
    return () => window.removeEventListener("osun:commute-to-work", requestCommute);
  }, []);

  /** Keyboard walking. Pressing a key cancels a tapped destination. */
  useEffect(() => {
    const set = (event: KeyboardEvent, pressed: boolean) => {
      const direction = KEY_DIRECTIONS[event.code];
      if (!direction) return;
      if (pressed) {
        autoWalkRouteRef.current = null;
        groundTargetRef.current = null;
        setGroundTarget(null);
        setHomeBound(false);
        setHasWalked(true);
      }
      setDirections((current) => {
        const next = new Set(current);
        if (pressed) next.add(direction);
        else next.delete(direction);
        return next;
      });
    };
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select"))
        return;
      set(event, true);
    };
    const up = (event: KeyboardEvent) => set(event, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /** Consume Walk Here / Board Keke navigation commands issued from the City Map. */
  const hasActivePlayer = Boolean(player);
  useEffect(() => {
    const activePlayer = playerRef.current;
    if (
      connectionState !== "connected" ||
      !hasActivePlayer ||
      !activePlayer ||
      !district ||
      !roomRef.current
    )
      return;
    const pendingNav = consumeNeighborhoodNavigation();
    if (!pendingNav) return;

    const room = roomRef.current;
    if (pendingNav.mode === "keke") {
      const worldDropOff = toWorld(pendingNav.dropOffScenePoint, district.origin);
      let acked = false;
      const onArrived = () => {
        acked = true;
      };
      room.onMessage("keke-arrived", onArrived);
      room.send("keke-dropoff", worldDropOff);
      dispatchZone(setPendingZoneId(pendingNav.primaryZoneId));
      const [dropThreeX, dropThreeZ] = scenePointToThreeXZ(pendingNav.dropOffScenePoint);
      publishLivePlayerPose({
        worldX: worldDropOff.x,
        worldY: worldDropOff.y,
        sceneX: pendingNav.dropOffScenePoint.x,
        sceneY: pendingNav.dropOffScenePoint.y,
        threeX: dropThreeX,
        threeZ: dropThreeZ,
        locationSlug: currentLocation?.slug ?? "city-centre",
        updatedAt: Date.now(),
      });
      toast.success(
        `Keke dropped you off at ${pendingNav.landmarkName} (-₦${pendingNav.fare.toLocaleString("en-NG")})`,
      );
      const fallbackTimer = window.setTimeout(() => {
        if (acked) return;
        startPathfindingTo(pendingNav.dropOffScenePoint);
      }, 450);
      return () => window.clearTimeout(fallbackTimer);
    }

    setPendingTargetId(null);
    setHomeBound(false);
    dispatchZone(setPendingZoneId(pendingNav.primaryZoneId));
    startPathfindingTo(pendingNav.targetScenePoint);
    toast.message(`Walking to ${pendingNav.landmarkName}`);
  }, [
    connectionState,
    currentLocation?.slug,
    district,
    hasActivePlayer,
    roomRef,
    startPathfindingTo,
  ]);

  /** Tapping or clicking the ground walks the character there. Panels hold them in place. */
  const tapGround = (point: { x: number; y: number }) => {
    if (anyModalOpen) return;
    setPendingTargetId(null);
    dispatchZone(setPendingZoneId(null));
    setHomeBound(false);
    startPathfindingTo(point);
  };

  useEffect(() => {
    if (connectionState !== "connected") return;
    if (anyModalOpen) {
      setDirections(new Set());
      roomRef.current?.send("move", { x: 0, y: 0 });
      lastIntentRef.current = "0:0";
    }
    const interval = window.setInterval(() => {
      const room = roomRef.current;
      if (!room) return;
      const currentPlayer = playerRef.current;
      const position = currentPlayer ? { x: currentPlayer.x, y: currentPlayer.y } : null;
      const scenePos =
        currentPlayer && district
          ? toScene({ x: currentPlayer.x, y: currentPlayer.y }, district.origin)
          : null;
      const target = groundTargetRef.current;
      if (
        target &&
        scenePos &&
        Math.hypot(target.x - scenePos.x, target.y - scenePos.y) <= GROUND_ARRIVE_DISTANCE
      ) {
        groundTargetRef.current = null;
        autoWalkRouteRef.current = null;
        setGroundTarget(null);
      }

      let autoIntent: { x: number; y: number } | null = null;
      if (autoWalkRouteRef.current && position) {
        const stepped = commuteIntent(
          position,
          autoWalkRouteRef.current.route,
          autoWalkRouteRef.current.index,
        );
        autoWalkRouteRef.current.index = stepped.index;
        autoIntent = stepped.intent;
        if (!stepped.intent) {
          autoWalkRouteRef.current = null;
          groundTargetRef.current = null;
          setGroundTarget(null);
        }
      }

      const tapped =
        autoIntent ??
        (target && scenePos ? groundIntent(target, scenePos) : groundIntent(target, position));
      const intent = anyModalOpen
        ? { x: 0, y: 0 }
        : (tapped ?? directionIntent(directionsRef.current));
      const next = `${intent.x}:${intent.y}`;
      if (next !== lastIntentRef.current || intent.x !== 0 || intent.y !== 0) {
        room.send("move", intent);
        lastIntentRef.current = next;
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [anyModalOpen, connectionState, district, roomRef]);

  /**
   * Leaving the house: report real loads, then close the veil once the neighbourhood has
   * settled, whether it connected or failed, so the page is never hidden behind it.
   */
  useEffect(() => {
    if (transition.kind !== "leaving") return;
    const steps = leavingStepsRef.current;
    if (!steps.data && currentLocation && npcQuery.isFetched && placesQuery.isFetched) {
      steps.data = true;
      completeTransitionStep("Connecting to the streets");
    }
    if (!steps.scene && connectionState === "connected" && scene) {
      steps.scene = true;
      completeTransitionStep("Ready");
    }
    const settled =
      connectionState === "unavailable" ||
      connectionState === "wrong-area" ||
      (connectionState === "connected" && scene !== null);
    if (settled) {
      endTransition();
      leavingStepsRef.current = { data: false, scene: false };
    }
  }, [
    transition,
    currentLocation,
    connectionState,
    npcQuery.isFetched,
    placesQuery.isFetched,
    scene,
  ]);

  // If the player leaves this page mid-transition, never leave the veil behind.
  useEffect(
    () => () => {
      if (currentTransitionKind() === "leaving") endTransition();
    },
    [],
  );

  const openZoneOrNpcInteraction = useCallback(() => {
    if (nearbyZoneMatch) {
      dispatchZone(openZoneInteraction({ zoneId: nearbyZoneMatch.zone.id }));
      return true;
    }
    if (nearbyZoneNpcMatch) {
      dispatchZone(openZoneInteraction({ npcId: nearbyZoneNpcMatch.npc.id }));
      return true;
    }
    return false;
  }, [nearbyZoneMatch, nearbyZoneNpcMatch]);

  useEffect(() => {
    if (
      connectionState !== "connected" ||
      anyModalOpen ||
      (!nearbyObject && !nearbyZoneMatch && !nearbyZoneNpcMatch)
    )
      return;
    const activate = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key.toLowerCase() !== "e" ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) ||
        enteringHome
      )
        return;
      event.preventDefault();
      if (openZoneOrNpcInteraction()) return;
      if (!nearbyObject) return;
      setSelectedBuildingName(nearbyObject.kind === "npc" ? null : nearbyObject.name);
      setSelectedShopSlug(nearbyObject.kind === "market" ? nearbyObject.shopSlug : undefined);
      if (nearbyObject.kind === "home") {
        activateHome();
      } else if (nearbyObject.kind === "npc") {
        setSelectedNpcId(nearbyObject.id);
        setNpcDialogue(null);
        setActivePanel("npc");
      } else if (nearbyObject.kind === "work") {
        setWorkView("actions");
        setActivePanel("work");
      } else {
        setBusinessView("actions");
        setActivePanel("business");
      }
    };
    window.addEventListener("keydown", activate);
    return () => window.removeEventListener("keydown", activate);
  }, [
    activateHome,
    anyModalOpen,
    connectionState,
    enteringHome,
    nearbyObject,
    nearbyZoneMatch,
    nearbyZoneNpcMatch,
    openZoneOrNpcInteraction,
  ]);

  const handleScene = useCallback((next: NeighborhoodSceneHandle | null) => setScene(next), []);
  const openInteraction = () => {
    if (openZoneOrNpcInteraction()) return;
    if (!nearbyObject) return;
    setSelectedBuildingName(nearbyObject.kind === "npc" ? null : nearbyObject.name);
    setSelectedShopSlug(nearbyObject.kind === "market" ? nearbyObject.shopSlug : undefined);
    if (nearbyObject.kind === "home") {
      enterHome.mutate();
    } else if (nearbyObject.kind === "npc") {
      setSelectedNpcId(nearbyObject.id);
      setNpcDialogue(null);
      setActivePanel("npc");
    } else if (nearbyObject.kind === "work") {
      setWorkView("actions");
      setActivePanel("work");
    } else {
      setBusinessView("actions");
      setActivePanel("business");
    }
  };
  /** Tapping a building or person walks the character to it, then opens the interaction. */
  const selectWorldTarget = (targetId: string) => {
    const target = interactionTargets.find((candidate) => candidate.id === targetId);
    if (!target) return;
    if (nearbyObject?.id === targetId) {
      setPendingTargetId(null);
      openInteraction();
      return;
    }
    toast.message(`Walking to ${target.name}`);
    setPendingTargetId(targetId);
    startPathfindingTo({ x: target.x, y: target.y });
  };
  useEffect(() => {
    if (!pendingTargetId || nearbyObject?.id !== pendingTargetId) return;
    setPendingTargetId(null);
    openInteraction();
    // openInteraction reads the current nearby object, which this effect already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTargetId, nearbyObject]);

  /** Tapping an InteractableZone or ZoneNpc walks to its walkable access point first, then opens the modal. */
  const selectZoneTarget = useCallback(
    (id: string) => {
      const zone = findInteractableZone(id);
      if (zone) {
        if (nearbyZoneMatch?.zone.id === id) {
          dispatchZone(openZoneInteraction({ zoneId: id }));
          return;
        }
        toast.message(`Walking to ${zone.title}`);
        setPendingTargetId(null);
        setHomeBound(false);
        dispatchZone(setPendingZoneId(id));
        startPathfindingTo(zone.accessPoint);
        return;
      }
      const npc = findZoneNpc(id);
      if (npc) {
        if (nearbyZoneNpcMatch?.npc.id === id) {
          dispatchZone(openZoneInteraction({ npcId: id }));
          return;
        }
        toast.message(`Walking to ${npc.name}`);
        setPendingTargetId(null);
        setHomeBound(false);
        dispatchZone(setPendingZoneId(id));
        startPathfindingTo(npc.accessPoint);
      }
    },
    [nearbyZoneMatch, nearbyZoneNpcMatch, startPathfindingTo],
  );

  useEffect(() => {
    const pendingId = zoneState.pendingZoneId;
    if (!pendingId) return;
    if (nearbyZoneMatch?.zone.id === pendingId) {
      dispatchZone(openZoneInteraction({ zoneId: pendingId }));
      return;
    }
    if (nearbyZoneNpcMatch?.npc.id === pendingId) {
      dispatchZone(openZoneInteraction({ npcId: pendingId }));
    }
  }, [nearbyZoneMatch, nearbyZoneNpcMatch, zoneState.pendingZoneId]);

  const handlePerformZoneAction = useCallback(
    (zoneSpec: InteractableZoneSpec, outcome: ZoneActionOutcome) => {
      dispatchZone(applyZoneOutcomeAction({ zoneTitle: zoneSpec.title, outcome }));
      syncZoneOutcomeToQueryCache(queryClient, zoneSpec.title, outcome);
      toast.success(outcome.toastMessage);
    },
    [queryClient],
  );

  const handleNpcTipSelect = useCallback(
    (npc: ZoneNpcSpec, tipIndex: number) => {
      const tip = npc.tips[tipIndex % npc.tips.length] ?? npc.greeting;
      dispatchZone(recordNpcChatAction({ npc, tip, socialBoost: 10 }));
      syncNpcChatToQueryCache(queryClient, 10);
      toast.success(
        `${npc.name.split("·")[0]?.trim() ?? npc.name} shared a local tip (+10 Social)`,
      );
    },
    [queryClient],
  );

  const handleToggleAccessory = useCallback((slug: string | null) => {
    dispatchZone(equipLocalAccessoryAction({ slug }));
    toast.success(
      slug ? "Equipped Craft Leather Backpack on your character!" : "Accessory unequipped.",
    );
  }, []);

  const effectiveNeeds = useMemo(
    () => effectiveNeedsFromCharacter(characterQuery.data, simulation.needs, zoneState.needOffsets),
    [characterQuery.data, simulation.needs, zoneState.needOffsets],
  );
  const pocketBalance = walletQuery.data?.balance ?? 5000 + zoneState.walletOffset;
  const bankBalance = walletQuery.data?.bank_balance ?? 12000 + zoneState.bankOffset;
  const activeZoneSpec = findInteractableZone(zoneState.activeZoneId);
  const activeZoneNpc = findZoneNpc(zoneState.activeNpcId);
  const closeInteraction = (open: boolean) => {
    if (open) return;
    setActivePanel(null);
    setSelectedBuildingName(null);
    setSelectedShopSlug(undefined);
    setSelectedNpcId(null);
  };
  const npcActions: readonly { action: SocialAction; label: string }[] = [
    { action: "greet", label: "Say hello" },
    { action: "work", label: "Ask about work" },
    { action: "interests", label: "Talk about interests" },
  ];
  const changeZoom = (factor: number) => {
    setZoom((current) =>
      Math.min(
        NEIGHBORHOOD_CAMERA.maxZoom,
        Math.max(NEIGHBORHOOD_CAMERA.minZoom, current * factor),
      ),
    );
  };

  if (characterQuery.isLoading || locationsQuery.isLoading)
    return (
      <section className="neighborhood-page" aria-label="Playable neighborhood">
        <WorldLoadingIndicator
          presentation="screen"
          title="Opening the neighbourhood"
          detail="Loading your saved character and location…"
        />
      </section>
    );
  if (characterQuery.isError || locationsQuery.isError)
    return (
      <section className="neighborhood-page" aria-label="Playable neighborhood">
        <p role="alert">
          {characterQuery.error?.message ??
            locationsQuery.error?.message ??
            "Your character location could not be loaded."}
        </p>
        <Link to="/map">Back to map</Link>
      </section>
    );

  return (
    <section className="neighborhood-page" aria-label="Playable neighborhood">
      <h1 className="sr-only">
        {district ? `${area.name} neighbourhood` : "Explore the neighbourhoods"}
      </h1>

      {connectionState === "wrong-area" ? (
        <div className="neighborhood-message" role="status">
          <strong>This destination is not available for walking yet.</strong>
          <span>
            This location does not have a supported neighborhood layout. Choose an eligible
            destination from the city map.
          </span>
          <Link to="/map">Open the city map</Link>
          <HomeLink>Go to your home entrance</HomeLink>
        </div>
      ) : (
        <div className="neighborhood-world-card">
          {connectionState === "connected" && !hasWalked && (
            <div className="neighborhood-walk-hint" aria-label="Movement instruction">
              Tap the ground or a zone to walk
            </div>
          )}
          {(connectionState === "connecting" ||
            connectionState === "loading" ||
            connectionState === "unavailable") && (
            <div className="neighborhood-loading-overlay">
              <WorldLoadingIndicator
                presentation="screen"
                title="Entering the neighbourhood"
                detail={
                  connectionState === "unavailable"
                    ? "Your connection is slow. Reconnecting automatically…"
                    : "Fetching your neighbourhood and connecting to the game server…"
                }
              />
            </div>
          )}
          {connectionState === "connected" &&
            (district?.personalHome && homeQuery.isLoading ? (
              <p className="neighborhood-loading">Checking the home entrance...</p>
            ) : (
              sessionId &&
              district && (
                <>
                  <div className="neighborhood-stage">
                    <Suspense
                      fallback={
                        <div className="neighborhood-loading-overlay">
                          <WorldLoadingIndicator
                            presentation="screen"
                            title="Loading the neighbourhood"
                            detail="Preparing the world scene…"
                          />
                        </div>
                      }
                    >
                      {commuting && (
                        <div className="commute-banner" role="status">
                          Heading to work
                        </div>
                      )}
                      <R3FNeighborhoodSurface
                        key={`${currentLocation?.id}:${sessionId}`}
                        onGroundTap={tapGround}
                        district={district}
                        players={scenePlayers}
                        npcs={activeNpcs}
                        selfSessionId={sessionId}
                        homeTypeId={homeTypeId}
                        zoom={zoom}
                        onZoomChange={setZoom}
                        groundTarget={groundTarget}
                        commuteTarget={
                          commuting
                            ? (area.objects.find((object) => object.kind === "work") ?? null)
                            : null
                        }
                        onScene={handleScene}
                        interactionTargets={interactionTargets}
                        onSelectTarget={selectWorldTarget}
                        onNpcArrive={(id, x, y) =>
                          setNpcPositionOverrides((current) => ({ ...current, [id]: { x, y } }))
                        }
                        nearbyZoneId={nearbyZoneMatch?.zone.id ?? null}
                        targetedZoneId={zoneState.pendingZoneId}
                        zoneNpcs={zoneNpcs}
                        nearbyZoneNpcId={nearbyZoneNpcMatch?.npc.id ?? null}
                        targetedZoneNpcId={zoneState.pendingZoneId}
                        onSelectZone={selectZoneTarget}
                        onSelectZoneNpc={selectZoneTarget}
                        onHoverZone={(id) => dispatchZone(setHoveredZoneId(id))}
                      />
                    </Suspense>
                    {minimapTelemetry && (
                      <NeighborhoodMinimap
                        telemetry={minimapTelemetry}
                        className="absolute left-3 top-[4.5rem] z-10 md:left-auto md:right-3 md:top-3"
                      />
                    )}
                    <div
                      className="neighborhood-zoom-controls"
                      aria-label="Neighborhood camera controls"
                    >
                      <button
                        type="button"
                        aria-label="Zoom in"
                        disabled={zoom >= NEIGHBORHOOD_CAMERA.maxZoom}
                        onClick={() => changeZoom(1.12)}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Zoom out"
                        disabled={zoom <= NEIGHBORHOOD_CAMERA.minZoom}
                        onClick={() => changeZoom(1 / 1.12)}
                      >
                        <Minus size={16} aria-hidden="true" />
                      </button>
                      <Link to="/map" aria-label="City map">
                        <Map size={16} aria-hidden="true" />
                      </Link>
                    </div>
                    {(nearbyZoneMatch || nearbyZoneNpcMatch || nearbyObject) && (
                      <button
                        type="button"
                        className="neighborhood-interaction"
                        disabled={
                          !nearbyZoneMatch &&
                          !nearbyZoneNpcMatch &&
                          nearbyObject?.kind === "home" &&
                          enteringHome
                        }
                        onClick={openInteraction}
                        aria-label={
                          nearbyZoneMatch
                            ? nearbyZoneMatch.zone.promptLabel
                            : nearbyZoneNpcMatch
                              ? `Chat with ${nearbyZoneNpcMatch.npc.name}`
                              : nearbyObject?.kind === "npc"
                                ? `Talk with ${nearbyNpc?.name ?? nearbyObject.name}`
                                : nearbyObject?.kind === "home"
                                  ? "Enter your home"
                                  : `Interact with ${nearbyObject?.name ?? ""}`
                        }
                      >
                        {nearbyZoneMatch ? (
                          <Store size={17} aria-hidden="true" />
                        ) : nearbyZoneNpcMatch ? (
                          <MessageCircle size={17} aria-hidden="true" />
                        ) : nearbyObject?.kind === "home" ? (
                          <Home size={17} aria-hidden="true" />
                        ) : nearbyObject?.kind === "market" ? (
                          <Store size={17} aria-hidden="true" />
                        ) : nearbyObject?.kind === "work" ? (
                          <BriefcaseBusiness size={17} aria-hidden="true" />
                        ) : (
                          <MessageCircle size={17} aria-hidden="true" />
                        )}
                        {nearbyZoneMatch
                          ? nearbyZoneMatch.zone.promptLabel
                          : nearbyZoneNpcMatch
                            ? `Chat · ${nearbyZoneNpcMatch.npc.name.split("·")[0]?.trim()}`
                            : nearbyObject?.kind === "home"
                              ? enteringHome
                                ? "Opening your home..."
                                : "Enter your home"
                              : nearbyObject?.kind === "npc"
                                ? `Talk with ${nearbyNpc?.name ?? nearbyObject.name}`
                                : nearbyObject?.kind === "work"
                                  ? `Work at ${nearbyObject.name}`
                                  : `Explore ${nearbyObject?.name ?? ""}`}
                        <kbd>E</kbd>
                      </button>
                    )}
                  </div>
                  {(activeNpcs.length > 0 || zoneNpcs.length > 0) && (
                    <button
                      type="button"
                      className="neighborhood-people-toggle"
                      aria-expanded={peopleOpen}
                      aria-controls="neighborhood-people-panel"
                      onClick={() => setPeopleOpen((open) => !open)}
                    >
                      <Users size={16} aria-hidden="true" />
                      People · {activeNpcs.length + zoneNpcs.length}
                    </button>
                  )}
                  {(activeNpcs.length > 0 || zoneNpcs.length > 0) && peopleOpen && (
                    <section
                      id="neighborhood-people-panel"
                      className="neighborhood-people"
                      aria-label="People in this neighbourhood"
                    >
                      <div className="neighborhood-people-heading">
                        <strong>People around here</strong>
                        <span>Tap anyone to walk over &amp; chat</span>
                      </div>
                      <div className="neighborhood-people-list">
                        {zoneNpcs.map((zNpc) => {
                          const isNearby = nearbyZoneNpcMatch?.npc.id === zNpc.id;
                          return (
                            <button
                              key={zNpc.id}
                              type="button"
                              className="neighborhood-person"
                              onClick={() => {
                                setPeopleOpen(false);
                                selectZoneTarget(zNpc.id);
                              }}
                            >
                              <span className="neighborhood-person-copy">
                                <strong>{zNpc.name}</strong>
                                <span>
                                  {zNpc.role} · {zNpc.zoneTag.replace("_", " ")}
                                </span>
                              </span>
                              <span className="neighborhood-person-action">
                                {isNearby ? "Chat" : "Walk over"}
                              </span>
                            </button>
                          );
                        })}
                        {activeNpcs.map((npc) => {
                          const isNearby = nearbyObject?.id === npc.id;
                          return (
                            <button
                              key={npc.id}
                              type="button"
                              className="neighborhood-person"
                              onClick={() => selectWorldTarget(npc.id)}
                              disabled={npc.isMoving || !npc.available}
                              aria-label={
                                isNearby
                                  ? `Talk with ${npc.name}, ${npc.activity}`
                                  : `${npc.name}, ${npc.activity}. Move closer to interact`
                              }
                            >
                              <span className="neighborhood-person-copy">
                                <strong>{npc.name}</strong>
                                <span>
                                  {npc.role} · {npc.activity}
                                </span>
                              </span>
                              <span className="neighborhood-person-action">
                                {npc.isMoving
                                  ? "On the move"
                                  : !npc.available
                                    ? "Resting"
                                    : isNearby
                                      ? "Talk"
                                      : "Move closer"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {enterHome.isError && (
                    <p className="neighborhood-error" role="alert">
                      {enterHome.error.message}
                    </p>
                  )}
                  {district.personalHome && homeQuery.isError && (
                    <p className="neighborhood-error" role="alert">
                      Your home information could not be loaded. Movement is available, but home
                      entry is temporarily disabled.
                    </p>
                  )}
                  {(npcQuery.isError ||
                    placesQuery.isError ||
                    shopItemsQuery.isError ||
                    jobsQuery.isError) && (
                    <p className="neighborhood-error" role="alert">
                      Some nearby interactions could not be loaded.{" "}
                      {npcQuery.error?.message ??
                        placesQuery.error?.message ??
                        shopItemsQuery.error?.message ??
                        jobsQuery.error?.message}
                    </p>
                  )}
                  {(npcQuery.isLoading ||
                    placesQuery.isLoading ||
                    shopItemsQuery.isLoading ||
                    jobsQuery.isLoading) && (
                    <p className="neighborhood-loading" role="status">
                      Checking for supported nearby interactions...
                    </p>
                  )}
                  <Dialog open={activePanel !== null} onOpenChange={closeInteraction}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                      <DialogTitle>
                        {activePanel === "npc"
                          ? (selectedNpc?.name ?? "Neighbour")
                          : (selectedBuildingName ?? currentLocation?.name ?? "Nearby services")}
                      </DialogTitle>
                      <DialogDescription>
                        {activePanel === "npc"
                          ? selectedNpc
                            ? `${selectedNpc.role} · ${selectedNpc.activity}`
                            : "This neighbour is no longer available here."
                          : "Choose a service supported by this location. Close this panel to return to the same spot."}
                      </DialogDescription>
                      {activePanel === "business" && (
                        <>
                          {businessView === "actions" && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {hasSelectedVenueInterior && (
                                <button
                                  type="button"
                                  className="neighborhood-action-card"
                                  onClick={() => setBusinessView("interior")}
                                >
                                  <DoorOpen size={18} aria-hidden="true" />
                                  Explore venue interior
                                </button>
                              )}
                              {activityLandmarkId && (
                                <a
                                  className="neighborhood-action-card"
                                  href={
                                    "/map?landmark=" +
                                    encodeURIComponent(activityLandmarkId) +
                                    "&details=1"
                                  }
                                >
                                  <Landmark size={18} aria-hidden="true" />
                                  View official place activities
                                </a>
                              )}
                              {hasSelectedShopOffers && (
                                <button
                                  type="button"
                                  className="neighborhood-action-card"
                                  onClick={() => setBusinessView("shops")}
                                >
                                  <Store size={18} aria-hidden="true" />
                                  Browse {selectedBuildingName ?? "local"} shop offers
                                </button>
                              )}
                              {selectedShopSlug === null && (
                                <p className="text-sm text-muted-foreground">
                                  This stall does not have its own server-backed shop catalogue yet.
                                  Browse the main Oja-Oba stalls for the currently available market
                                  offers.
                                </p>
                              )}
                              {hasBankServices && (
                                <button
                                  type="button"
                                  className="neighborhood-action-card"
                                  onClick={() => setBusinessView("bank")}
                                >
                                  <Landmark size={18} aria-hidden="true" />
                                  Access bank services
                                </button>
                              )}
                              {!hasShopOffers && hasLocalBusinesses && (
                                <p className="text-sm text-muted-foreground">
                                  This location has shops, but no purchasable offers are available
                                  in the existing shop catalog.
                                </p>
                              )}
                            </div>
                          )}
                          {businessView === "interior" && currentLocation && (
                            <>
                              <button
                                type="button"
                                className="neighborhood-map-link w-fit"
                                onClick={() => setBusinessView("actions")}
                              >
                                Exit to the neighborhood
                              </button>
                              <LocationVenueScene
                                slug={currentLocation.slug}
                                locationName={currentLocation.name}
                              />
                            </>
                          )}
                          {businessView === "shops" && (
                            <>
                              <button
                                type="button"
                                className="neighborhood-map-link w-fit"
                                onClick={() => setBusinessView("actions")}
                              >
                                Back to building actions
                              </button>
                              <MarketPage shopSlug={selectedShopSlug ?? null} />
                            </>
                          )}
                          {businessView === "bank" && (
                            <>
                              <button
                                type="button"
                                className="neighborhood-map-link w-fit"
                                onClick={() => setBusinessView("actions")}
                              >
                                Back to building actions
                              </button>
                              <PhoneBankApp />
                            </>
                          )}
                        </>
                      )}
                      {activePanel === "work" && (
                        <>
                          {workView === "actions" ? (
                            <>
                              {hasVenueInterior && (
                                <button
                                  type="button"
                                  className="neighborhood-action-card mb-4"
                                  onClick={() => setWorkView("interior")}
                                >
                                  <DoorOpen size={18} aria-hidden="true" />
                                  Explore workplace interior
                                </button>
                              )}
                              <JobsPage />
                            </>
                          ) : currentLocation ? (
                            <>
                              <button
                                type="button"
                                className="neighborhood-map-link w-fit"
                                onClick={() => setWorkView("actions")}
                              >
                                Exit to the neighborhood
                              </button>
                              <LocationVenueScene
                                slug={currentLocation.slug}
                                locationName={currentLocation.name}
                              />
                            </>
                          ) : null}
                        </>
                      )}
                      {activePanel === "npc" && selectedNpc && (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            {selectedNpc.name} is {selectedNpc.activity}. Conversations are checked
                            by the game server for this location and time.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {npcActions.map(({ action, label }) => (
                              <button
                                key={action}
                                type="button"
                                className="neighborhood-action-card"
                                disabled={npcInteraction.isPending}
                                onClick={() =>
                                  npcInteraction.mutate({
                                    npcId: selectedNpc.id,
                                    action,
                                    requestId: crypto.randomUUID(),
                                  })
                                }
                              >
                                <MessageCircle size={17} aria-hidden="true" />
                                {npcInteraction.isPending ? "Speaking..." : label}
                              </button>
                            ))}
                          </div>
                          {npcDialogue && (
                            <p className="rounded-lg bg-muted/50 p-3 text-sm" aria-live="polite">
                              {npcDialogue}
                            </p>
                          )}
                          {npcInteraction.error && (
                            <p className="text-sm text-destructive" role="alert">
                              {npcInteraction.error.message}
                            </p>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <NeighborhoodZoneModal
                    open={zoneModalOpen}
                    onOpenChange={(open) => {
                      if (!open) dispatchZone(closeZoneInteraction());
                    }}
                    zone={activeZoneSpec}
                    npc={activeZoneNpc}
                    pocketBalance={pocketBalance}
                    bankBalance={bankBalance}
                    needs={effectiveNeeds}
                    localInventory={zoneState.localInventory}
                    equippedAccessorySlug={zoneState.equippedAccessorySlug}
                    currentLocationId={currentLocation?.id}
                    npcTip={zoneState.lastNpcTip}
                    onPerformZoneAction={handlePerformZoneAction}
                    onNpcTipSelect={handleNpcTipSelect}
                    onToggleAccessory={handleToggleAccessory}
                  />
                  <div className="neighborhood-controls-row">
                    {homeTypeId && (
                      <button
                        type="button"
                        className="neighborhood-go-home"
                        disabled={enteringHome || homeBound}
                        aria-busy={enteringHome || homeBound}
                        onClick={() => activateHome()}
                      >
                        {enteringHome || homeBound ? "Going home…" : "Go home"}
                      </button>
                    )}
                  </div>
                </>
              )
            ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        Camera zoom {Math.round(zoom * 100)} percent.
      </p>
    </section>
  );
}
