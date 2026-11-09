import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { GROUND_ARRIVE_DISTANCE, groundIntent } from "@/game/ground-intent";
import { joinNeighborhood, type NeighborhoodRoom } from "@/lib/multiplayer-service";
import { q, rpc, useGameAction } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import { canonicalHomeOptions } from "@/lib/living-cost-service";
import { useGameTime } from "@/components/game/GameTimeProvider";
import type { NetworkPlayerSnapshot } from "@/game/multiplayer-state";
import { avatarAnimationForActivity } from "@/game/character-animation";
import {
  availableNeighborhoodTargets,
  venueEntranceKindForCategory,
} from "@/game/neighborhood-interactions";
import {
  neighborhoodAreaForSlug,
  nearestInteraction,
  toScene,
  toWorld,
  type NeighborhoodNpcView,
} from "@/game/neighborhood-model";
import { isPlayableDistrict, playableDistrictForLocation } from "@/game/playable-district";
import type { NeighborhoodPlayerView, PhaserNeighborhoodHandle } from "@/game/phaser-neighborhood";
import { NPC_CATALOG, npcActivityAt, type SocialAction } from "@/lib/npc-simulation";
import { hasLocationVenueDesign } from "@/lib/location-venue-designs";
import { JobsPage } from "@/routes/_authenticated/_game/jobs";
import { MarketPage } from "@/routes/_authenticated/_game/market";
import { WORLD_CAMERA } from "@/components/3d/world-theme";
import { neighborhoodNpcDestinationPoint, neighborhoodNpcSpawnPoint } from "@/game/neighborhood-npc-layout";
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
) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("loading");
  const [players, setPlayers] = useState<NeighborhoodPlayerView[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [roomLocationId, setRoomLocationId] = useState<string | null>(null);
  const roomRef = useRef<NeighborhoodRoom | null>(null);

  useEffect(() => {
    setPlayers([]);
    setSessionId(null);
    setRoomLocationId(null);
    if (!locationId || !slug) {
      setConnectionState("unavailable");
      setConnectionError(
        "Your saved world location could not be resolved. Return to the city map.",
      );
      return;
    }
    if (!locationIsPlayable || !isPlayableDistrict(slug)) {
      setConnectionState("wrong-area");
      setPlayers([]);
      setSessionId(null);
      setConnectionError("");
      return;
    }

    let active = true;
    let joinTimedOut = false;
    let roomEnded = false;
    let joinedRoom: NeighborhoodRoom | null = null;
    let joinTimeout = 0;
    let stateTimeout = 0;
    setConnectionState("connecting");
    setConnectionError("");

    joinTimeout = window.setTimeout(() => {
      if (!active) return;
      joinTimedOut = true;
      setConnectionState("unavailable");
      setConnectionError("The neighborhood is taking too long to connect. Please try again.");
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
        room.onLeave((code) => {
          if (!active || roomEnded) return;
          roomEnded = true;
          window.clearTimeout(stateTimeout);
          roomRef.current = null;
          joinedRoom = null;
          setPlayers([]);
          setConnectionState("unavailable");
          setConnectionError(
            `The neighborhood connection closed (${code}). Reconnect to continue.`,
          );
        });
        if (!publish()) {
          stateTimeout = window.setTimeout(() => {
            if (!active || roomEnded) return;
            roomEnded = true;
            roomRef.current = null;
            joinedRoom = null;
            setConnectionState("unavailable");
            setConnectionError(
              "The neighborhood connected but its world state did not finish loading. Please try again.",
            );
            void room
              .leave()
              .catch((error: unknown) =>
                console.error("Could not close the neighborhood room.", error),
              );
          }, NEIGHBORHOOD_STATE_TIMEOUT_MS);
        }
      })
      .catch((error: unknown) => {
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
        setConnectionError(
          error instanceof Error ? error.message : "The neighborhood could not be connected.",
        );
      });

    return () => {
      active = false;
      window.clearTimeout(joinTimeout);
      window.clearTimeout(stateTimeout);
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
    connectionError,
    players: sameLocation ? players : [],
    sessionId: sameLocation ? sessionId : null,
    roomRef,
  };
}

function homeTypeFromRecord(value: unknown) {
  if (!isRecord(value) || typeof value["houseTypeId"] !== "string") return null;
  return value["houseTypeId"];
}

export function PlayableNeighborhood() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { simulation } = useGameTime();
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const characterQuery = useQuery(q.character());
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
  const { connectionState, connectionError, players, sessionId, roomRef } =
    useNeighborhoodConnection(
      currentLocation?.id,
      currentLocation?.slug,
      district !== null,
      connectionAttempt,
    );
  const [groundTarget, setGroundTarget] = useState<{ x: number; y: number } | null>(null);
  const groundTargetRef = useRef(groundTarget);
  groundTargetRef.current = groundTarget;
  const transition = useOutsideTransition();
  const leavingStepsRef = useRef({ data: false, scene: false });
  const [scene, setScene] = useState<PhaserNeighborhoodHandle | null>(null);
  const [zoom, setZoom] = useState<number>(WORLD_CAMERA.defaultZoom);
  const lastIntentRef = useRef("0:0");
  const [activePanel, setActivePanel] = useState<InteractionPanel | null>(null);
  /** A tapped building or person the character is walking to; interaction opens on arrival. */
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  /** Set while the character walks to its home door after Go home. */
  const [homeBound, setHomeBound] = useState(false);
  const [businessView, setBusinessView] = useState<BusinessView>("actions");
  const [workView, setWorkView] = useState<"actions" | "interior">("actions");
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [npcDialogue, setNpcDialogue] = useState<string | null>(null);
  const [npcPositionOverrides, setNpcPositionOverrides] = useState<{
    locationId: string | null;
    positions: Record<string, { x: number; y: number }>;
  }>({ locationId: null, positions: {} });
  // Ignore snapshots from the previous area immediately, before effects run.
  const currentNpcPositionOverrides =
    npcPositionOverrides.locationId === currentLocation?.id
      ? npcPositionOverrides.positions
      : {};
  const player = players.find((candidate) => candidate.sessionId === sessionId);
  const actionAnimation = simulation.currentAction
    ? avatarAnimationForActivity(simulation.currentAction.animation)
    : undefined;
  const scenePlayers = useMemo(
    () =>
      players.map((candidate) =>
        candidate.sessionId === sessionId && actionAnimation
          ? { ...candidate, actionAnimation }
          : candidate,
      ),
    [actionAnimation, players, sessionId],
  );
  const activeNpcs = useMemo((): NeighborhoodNpcView[] => {
    if (!currentLocation || !npcQuery.data || !locationsQuery.data) return [];
    const savedNpcIds = new Set(npcQuery.data.map((npc) => npc.id));
    const slots = area.objects.filter((object) => object.kind === "npc");
    const scheduled = NPC_CATALOG.flatMap((npc, catalogIndex) => {
      if (!savedNpcIds.has(npc.id)) return [];
      const activity = npcActivityAt(
        npc,
        simulation.gameTime,
        (slug) => locationsQuery.data?.find((location) => location.slug === slug)?.id ?? null,
      );
      return activity.destinationSlug === currentLocation.slug ? [{ npc, activity, catalogIndex }] : [];
    });
    return scheduled.flatMap(({ npc, activity, catalogIndex }, index) => {
      const slot = neighborhoodNpcSpawnPoint(slots, index);
      if (!slot) return [];
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
      const current = currentNpcPositionOverrides[npc.id] ?? { x: slot.x, y: slot.y };
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
      return [{
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
      }];
    });
  }, [
    area.objects,
    area.obstacles,
    currentLocation,
    locationsQuery.data,
    currentNpcPositionOverrides,
    npcQuery.data,
    simulation.gameTime,
    simulation.paused,
  ]);
  const localPlaces =
    placesQuery.data?.filter((place) => place.location_id === currentLocation?.id) ?? [];
  const hasShopOffers =
    shopItemsQuery.data?.some((offer) => offer.shop?.location_id === currentLocation?.id) ?? false;
  const hasBankServices =
    currentLocation?.type === "bank" ||
    localPlaces.some((place) => place.category === "bank" || place.category === "atm");
  const hasCareerServices =
    jobsQuery.data?.some((job) => job.is_available && job.location_id === currentLocation?.id) ??
    false;
  const hasVenueInterior = currentLocation ? hasLocationVenueDesign(currentLocation.slug) : false;
  const venueEntranceKind = hasVenueInterior
    ? venueEntranceKindForCategory(currentLocation?.map_category)
    : null;
  const hasLocalBusinesses = localPlaces.some((place) =>
    BUSINESS_PLACE_CATEGORIES.has(place.category),
  );
  const interactionObjects = useMemo(
    () => [
      ...area.objects.filter((object) => object.kind !== "npc"),
      ...activeNpcs.map((npc) => ({
        id: npc.id,
        name: npc.name,
        kind: "npc" as const,
        x: npc.x,
        y: npc.y,
      })),
    ],
    [activeNpcs, area.objects],
  );
  const interactionTargets = useMemo(
    () =>
      availableNeighborhoodTargets(interactionObjects, {
        hasPersonalHome: !!district?.personalHome,
        hasHomeType: !!homeTypeId,
        hasShopOffers,
        hasLocalBusinesses,
        hasBankServices,
        venueEntranceKind,
        hasCareerServices,
      }),
    [
      interactionObjects,
      district?.personalHome,
      homeTypeId,
      hasShopOffers,
      hasLocalBusinesses,
      hasBankServices,
      venueEntranceKind,
      hasCareerServices,
    ],
  );
  const nearbyObject = useMemo(() => {
    if (!player || !district) return null;
    const point = toScene({ x: player.x, y: player.y }, district.origin);
    return nearestInteraction(point, interactionTargets);
  }, [interactionTargets, player, district]);
  const nearbyNpc =
    nearbyObject?.kind === "npc"
      ? (activeNpcs.find((npc) => npc.id === nearbyObject.id) ?? null)
      : null;
  // Once an NPC is explicitly selected, never substitute a different nearby NPC
  // if that scheduled character leaves or becomes unavailable.
  const selectedNpc = selectedNpcId
    ? (activeNpcs.find((npc) => npc.id === selectedNpcId) ?? null)
    : nearbyNpc;
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
        throw new Error("Your personal home is not available from this neighborhood.");
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
    groundTargetRef.current = toWorld({ x: homeObject.x, y: homeObject.y }, district.origin);
    setGroundTarget(groundTargetRef.current);
    setHomeBound(true);
  }, [nearHome, homeObject, district?.personalHome, enterHomeNow]);
  const enteringHome = enterHome.isPending;

  /** Stop any outstanding tap destination before an interaction takes control. */
  const stopGroundMovement = useCallback(() => {
    groundTargetRef.current = null;
    setGroundTarget(null);
    setPendingTargetId(null);
    setHomeBound(false);
  }, []);
  useEffect(() => {
    if (!homeBound || nearbyObject?.kind !== "home") return;
    setHomeBound(false);
    enterHome.mutate();
    // enterHome is stable for this render; the effect only reacts to arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeBound, nearbyObject]);

  useEffect(() => {
    groundTargetRef.current = null;
    setGroundTarget(null);
    setPendingTargetId(null);
    setHomeBound(false);
    lastIntentRef.current = "0:0";
    setZoom(WORLD_CAMERA.defaultZoom);
    setActivePanel(null);
    setBusinessView("actions");
    setWorkView("actions");
    setSelectedNpcId(null);
    setNpcDialogue(null);
  }, [currentLocation?.id]);

  /** Tapping or clicking the ground walks the character there. Panels hold them in place. */
  const tapGround = (point: { x: number; y: number }) => {
    if (activePanel) return;
    setPendingTargetId(null);
    setHomeBound(false);
    // The movement loop reads the ref, so keep it in sync when the player taps an open point.
    groundTargetRef.current = point;
    setGroundTarget(point);
  };

  useEffect(() => {
    if (connectionState !== "connected") return;
    if (activePanel) {
      roomRef.current?.send("move", { x: 0, y: 0 });
      lastIntentRef.current = "0:0";
    }
    const interval = window.setInterval(() => {
      const room = roomRef.current;
      if (!room) return;
      const position = player ? { x: player.x, y: player.y } : null;
      const target = groundTargetRef.current;
      if (
        target &&
        position &&
        Math.hypot(target.x - position.x, target.y - position.y) <= GROUND_ARRIVE_DISTANCE
      ) {
        groundTargetRef.current = null;
        setGroundTarget(null);
      }
      const tapped = groundIntent(groundTargetRef.current, position);
      const intent = activePanel ? { x: 0, y: 0 } : (tapped ?? { x: 0, y: 0 });
      const next = `${intent.x}:${intent.y}`;
      if (next !== lastIntentRef.current || intent.x !== 0 || intent.y !== 0) {
        room.send("move", intent);
        lastIntentRef.current = next;
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [activePanel, connectionState, roomRef, player]);

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

  const handleScene = useCallback((next: PhaserNeighborhoodHandle | null) => setScene(next), []);
  const openInteraction = (target: NeighborhoodObject | null = nearbyObject) => {
    if (!target) return;
    stopGroundMovement();
    if (target.kind === "home") {
      enterHome.mutate();
    } else if (target.kind === "npc") {
      setSelectedNpcId(target.id);
      setNpcDialogue(null);
      setActivePanel("npc");
    } else if (target.kind === "work") {
      setWorkView("actions");
      setActivePanel("work");
    } else if (target.kind === "market") {
      setBusinessView("actions");
      setActivePanel("business");
    }
  };
  /** Tapping a building or person walks the character to it, then opens the interaction. */
  const selectWorldTarget = (targetId: string) => {
    const target = interactionTargets.find((candidate) => candidate.id === targetId);
    if (!target || !district) return;
    if (nearbyObject?.id === targetId) {
      setPendingTargetId(null);
      openInteraction(target);
      return;
    }
    toast.message(`Walking to ${target.name}`);
    setHomeBound(false);
    setPendingTargetId(targetId);
    const interactionPoint = neighborhoodInteractionPoint(target, activeNpcs);
    const destination = toWorld(interactionPoint, district.origin);
    groundTargetRef.current = destination;
    setGroundTarget(destination);
  };
  // NPC schedules can change while the player is walking. Keep the destination aligned
  // with the selected character's latest scheduled stop rather than its old spawn point.
  useEffect(() => {
    if (!pendingTargetId || !district) return;
    const target = interactionTargets.find((candidate) => candidate.id === pendingTargetId);
    if (!target || target.kind !== "npc") return;
    const destination = toWorld(neighborhoodInteractionPoint(target, activeNpcs), district.origin);
    groundTargetRef.current = destination;
    setGroundTarget(destination);
  }, [activeNpcs, district, interactionTargets, pendingTargetId]);
  useEffect(() => {
    if (!pendingTargetId || !player || !district) return;
    const target = interactionTargets.find((candidate) => candidate.id === pendingTargetId);
    if (!target) return;
    const interactionPoint = neighborhoodInteractionPoint(target, activeNpcs);
    const position = toScene({ x: player.x, y: player.y }, district.origin);
    if (Math.hypot(position.x - interactionPoint.x, position.y - interactionPoint.y) >= 65) return;
    setPendingTargetId(null);
    openInteraction(target);
    // Arrival is checked against the requested target itself, not whichever target
    // happens to be nearest when two interaction ranges overlap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTargetId, player, district, interactionTargets, activeNpcs]);
  useEffect(() => {
    if (!pendingTargetId || interactionTargets.some((target) => target.id === pendingTargetId))
      return;
    // A service or NPC can disappear while the player is walking toward it.
    // Cancel the stale destination instead of opening an unrelated interaction later.
    groundTargetRef.current = null;
    setGroundTarget(null);
    setPendingTargetId(null);
  }, [pendingTargetId, interactionTargets]);
  const closeInteraction = (open: boolean) => {
    if (open) return;
    setActivePanel(null);
    setSelectedNpcId(null);
  };
  const npcActions: readonly { action: SocialAction; label: string }[] = [
    { action: "greet", label: "Say hello" },
    { action: "work", label: "Ask about work" },
    { action: "interests", label: "Talk about interests" },
  ];
  const changeZoom = (factor: number) => {
    setZoom((current) =>
      Math.min(WORLD_CAMERA.maxZoom, Math.max(WORLD_CAMERA.minZoom, current * factor)),
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
      <header className="neighborhood-header">
        <div>
          <p className="neighborhood-eyebrow">Osogbo Life · Playable world</p>
          <h1>{district ? `${area.name} neighbourhood` : "Explore the neighbourhoods"}</h1>
          <p>
            {district
              ? `Explore the streets, local businesses and landmarks of ${area.name}.`
              : "Travel to an eligible destination to explore its neighborhood."}
          </p>
        </div>
        <Link className="neighborhood-map-link" to="/map">
          <Map size={17} aria-hidden="true" /> City map
        </Link>
      </header>

      {connectionState === "wrong-area" ? (
        <div className="neighborhood-message" role="status">
          <strong>This destination is not available for walking yet.</strong>
          <span>
            This location does not have a supported neighborhood layout. Choose an eligible
            destination from the city map.
          </span>
          <Link to="/map">Open the city map</Link>
          <Link to="/house">Go to your home entrance</Link>
        </div>
      ) : (
        <div className="neighborhood-world-card">
          <div className="neighborhood-world-status">
            <span className={connectionState === "connected" ? "is-connected" : ""} />
            {connectionState === "connected"
              ? `Connected · ${players.length} ${players.length === 1 ? "resident" : "residents"}`
              : connectionState === "unavailable"
                ? "Connection unavailable"
                : "Connecting to the authoritative world..."}
          </div>
          {connectionState === "unavailable" && (
            <div className="neighborhood-error">
              <p role="alert">{connectionError}</p>
              <button
                type="button"
                className="neighborhood-map-link"
                onClick={() => setConnectionAttempt((attempt) => attempt + 1)}
              >
                Retry connection
              </button>
            </div>
          )}
          {(connectionState === "connecting" || connectionState === "loading") && (
            <div className="neighborhood-loading-overlay">
              <WorldLoadingIndicator
                presentation="screen"
                title="Entering the neighbourhood"
                detail="Connecting to the authoritative world…"
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
                      <R3FNeighborhoodSurface
                        key={`${currentLocation?.id}:${sessionId}`}
                        onGroundTap={tapGround}
                        district={district}
                        mapCategory={currentLocation?.map_category}
                        players={scenePlayers}
                        npcs={activeNpcs}
                        selfSessionId={sessionId}
                        homeTypeId={homeTypeId}
                        zoom={zoom}
                        onZoomChange={setZoom}
                        groundTarget={groundTarget}
                        onScene={handleScene}
                        interactionTargets={interactionTargets}
                        onSelectTarget={selectWorldTarget}
                        onNpcArrive={(id, x, y) =>
                          setNpcPositionOverrides((current) => ({
                            locationId: currentLocation?.id ?? null,
                            positions: {
                              ...(current.locationId === currentLocation?.id ? current.positions : {}),
                              [id]: { x, y },
                            },
                          }))
                        }
                      />
                    </Suspense>
                    <div
                      className="neighborhood-zoom-controls"
                      aria-label="Neighborhood camera controls"
                    >
                      <button
                        type="button"
                        aria-label="Zoom in"
                        disabled={zoom >= WORLD_CAMERA.maxZoom}
                        onClick={() => changeZoom(1.12)}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Zoom out"
                        disabled={zoom <= WORLD_CAMERA.minZoom}
                        onClick={() => changeZoom(1 / 1.12)}
                      >
                        <Minus size={16} aria-hidden="true" />
                      </button>
                    </div>
                    {nearbyObject && (
                      <button
                        type="button"
                        className="neighborhood-interaction"
                        disabled={nearbyObject.kind === "home" && enteringHome}
                        onClick={openInteraction}
                        aria-label={
                          nearbyObject.kind === "npc"
                            ? `Talk with ${nearbyNpc?.name ?? nearbyObject.name}`
                            : nearbyObject.kind === "home"
                              ? "Enter your home"
                              : `Interact with ${currentLocation?.name ?? nearbyObject.name}`
                        }
                      >
                        {nearbyObject.kind === "home" ? (
                          <Home size={17} aria-hidden="true" />
                        ) : nearbyObject.kind === "market" ? (
                          <Store size={17} aria-hidden="true" />
                        ) : nearbyObject.kind === "work" ? (
                          <BriefcaseBusiness size={17} aria-hidden="true" />
                        ) : (
                          <MessageCircle size={17} aria-hidden="true" />
                        )}
                        {nearbyObject.kind === "home"
                          ? enteringHome
                            ? "Opening your home..."
                            : "Enter your home"
                          : nearbyObject.kind === "npc"
                            ? `Talk with ${nearbyNpc?.name ?? nearbyObject.name}`
                            : nearbyObject.kind === "work"
                              ? `Work at ${currentLocation?.name ?? nearbyObject.name}`
                              : `Explore ${currentLocation?.name ?? nearbyObject.name}`}
                      </button>
                    )}
                  </div>
                  {activeNpcs.length > 0 && (
                    <section
                      className="neighborhood-people"
                      aria-label="People in this neighbourhood"
                    >
                      <div className="neighborhood-people-heading">
                        <strong>People around here</strong>
                        <span>NPCs follow their own daily routines</span>
                      </div>
                      <div className="neighborhood-people-list">
                        {activeNpcs.map((npc) => {
                          const isNearby = nearbyObject?.id === npc.id;
                          return (
                            <button
                              key={npc.id}
                              type="button"
                              className="neighborhood-person"
                              onClick={() => selectWorldTarget(npc.id)}
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
                          : (currentLocation?.name ?? "Nearby services")}
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
                              {hasVenueInterior && (
                                <button
                                  type="button"
                                  className="neighborhood-action-card"
                                  onClick={() => setBusinessView("interior")}
                                >
                                  <DoorOpen size={18} aria-hidden="true" />
                                  Explore location interior
                                </button>
                              )}
                              {hasShopOffers && (
                                <button
                                  type="button"
                                  className="neighborhood-action-card"
                                  onClick={() => setBusinessView("shops")}
                                >
                                  <Store size={18} aria-hidden="true" />
                                  Browse local shop offers
                                </button>
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
                              <MarketPage />
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
                                  Explore location interior
                                </button>
                              )}
                              {hasCareerServices && <JobsPage />}
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
                  <div className="neighborhood-controls-row">
                    <div className="neighborhood-control-copy">
                      <strong>Explore at your pace</strong>
                      <span>Tap or click open ground to walk, or select a person or building to approach it.</span>
                    </div>
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
