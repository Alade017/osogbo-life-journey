import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Map, Minus, Plus } from "lucide-react";
import { PlayerMovementControls } from "@/components/game/PlayerMovementControls";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";
import { joinNeighborhood, type NeighborhoodRoom } from "@/lib/multiplayer-service";
import { q } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import { canonicalHomeOptions } from "@/lib/living-cost-service";
import { useGameTime } from "@/components/game/GameTimeProvider";
import type { NetworkPlayerSnapshot } from "@/game/multiplayer-state";
import { avatarAnimationForActivity } from "@/game/character-animation";
import { neighborhoodAreaForSlug, nearestInteraction, toScene } from "@/game/neighborhood-model";
import { isPlayableDistrict, playableDistrictForLocation } from "@/game/playable-district";
import type { NeighborhoodPlayerView, PhaserNeighborhoodHandle } from "@/game/phaser-neighborhood";
import type { MovementDirection } from "@/lib/player-movement";
import { WORLD_CAMERA } from "@/components/3d/world-theme";
import "@/components/game/neighborhood.css";

const R3FNeighborhoodSurface = lazy(() =>
  import("./R3FNeighborhoodSurface").then((module) => ({ default: module.R3FNeighborhoodSurface })),
);

type ConnectionState = "loading" | "connecting" | "connected" | "unavailable" | "wrong-area";

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

function useNeighborhoodConnection(locationId: string | undefined, slug: string | undefined) {
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
    if (!isPlayableDistrict(slug)) {
      setConnectionState("wrong-area");
      setPlayers([]);
      setSessionId(null);
      setConnectionError("");
      return;
    }

    let active = true;
    let joinedRoom: NeighborhoodRoom | null = null;
    setConnectionState("connecting");
    setConnectionError("");

    void joinNeighborhood(locationId)
      .then((room) => {
        if (!active) {
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
          if (!snapshot) return;
          setPlayers(snapshot);
          setConnectionState("connected");
        };
        room.onStateChange(publish);
        room.onLeave((code) => {
          if (!active) return;
          roomRef.current = null;
          setConnectionState("unavailable");
          setConnectionError(
            `The neighborhood connection closed (${code}). Reconnect to continue.`,
          );
        });
        publish();
      })
      .catch((error: unknown) => {
        if (!active) return;
        setConnectionState("unavailable");
        setConnectionError(
          error instanceof Error ? error.message : "The neighborhood could not be connected.",
        );
      });

    return () => {
      active = false;
      roomRef.current = null;
      if (joinedRoom) {
        void joinedRoom
          .leave()
          .catch((error: unknown) =>
            console.error("Could not close the neighborhood room.", error),
          );
      }
    };
  }, [locationId, slug]);

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

function directionIntent(directions: ReadonlySet<MovementDirection>) {
  return {
    x: Number(directions.has("east")) - Number(directions.has("west")),
    y: Number(directions.has("south")) - Number(directions.has("north")),
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
  const characterQuery = useQuery(q.character());
  const locationsQuery = useQuery({
    ...q.locations(),
    enabled: !!characterQuery.data?.current_location_id,
  });
  const currentLocation = locationsQuery.data?.find(
    (location) => location.id === characterQuery.data?.current_location_id,
  );
  const district = useMemo(() => playableDistrictForLocation(currentLocation), [currentLocation]);
  const homeQuery = useQuery({
    ...canonicalHomeOptions(characterQuery.data?.id),
    enabled: !!characterQuery.data?.id && currentLocation?.slug === "city-centre",
  });
  const homeTypeId = district?.personalHome ? homeTypeFromRecord(homeQuery.data) : null;
  const { connectionState, connectionError, players, sessionId, roomRef } =
    useNeighborhoodConnection(currentLocation?.id, currentLocation?.slug);
  const [directions, setDirections] = useState<ReadonlySet<MovementDirection>>(() => new Set());
  const [scene, setScene] = useState<PhaserNeighborhoodHandle | null>(null);
  const [zoom, setZoom] = useState<number>(WORLD_CAMERA.defaultZoom);
  const directionsRef = useRef(directions);
  directionsRef.current = directions;
  const lastIntentRef = useRef("0:0");
  const area = district?.area ?? neighborhoodAreaForSlug("city-centre");
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
  const nearbyObject = useMemo(() => {
    if (!player || !district) return null;
    const point = toScene({ x: player.x, y: player.y }, district.origin);
    return nearestInteraction(point, area.objects);
  }, [area.objects, player, district]);

  const enterHome = useMutation({
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
      await queryClient.invalidateQueries({ queryKey: q.character().queryKey });
      await navigate({ to: "/house" });
    },
  });
  const activateHome = enterHome.mutate;
  const enteringHome = enterHome.isPending;

  useEffect(() => {
    setDirections(new Set());
    lastIntentRef.current = "0:0";
    setZoom(WORLD_CAMERA.defaultZoom);
  }, [currentLocation?.id]);

  useEffect(() => {
    if (connectionState !== "connected") return;
    const interval = window.setInterval(() => {
      const room = roomRef.current;
      if (!room) return;
      const intent = directionIntent(directionsRef.current);
      const next = `${intent.x}:${intent.y}`;
      if (next !== lastIntentRef.current || intent.x !== 0 || intent.y !== 0) {
        room.send("move", intent);
        lastIntentRef.current = next;
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [connectionState, roomRef]);

  useEffect(() => {
    if (connectionState !== "connected" || nearbyObject?.kind !== "home" || !homeTypeId) return;
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
      activateHome();
    };
    window.addEventListener("keydown", activate);
    return () => window.removeEventListener("keydown", activate);
  }, [activateHome, connectionState, enteringHome, homeTypeId, nearbyObject?.kind]);

  const handleScene = useCallback((next: PhaserNeighborhoodHandle | null) => setScene(next), []);
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
            {district?.area.slug === "oja-oba"
              ? "Explore market lanes, covered stalls and the loading yard."
              : "Walk the crossing, residential compounds and local shopfronts."}
          </p>
        </div>
        <Link className="neighborhood-map-link" to="/map">
          <Map size={17} aria-hidden="true" /> City map
        </Link>
      </header>

      {connectionState === "wrong-area" ? (
        <div className="neighborhood-message" role="status">
          <strong>This district is not available for walking yet.</strong>
          <span>
            Use the city map to travel to Olaiya or Oja-Oba Market. Your confirmed arrival selects
            the neighbourhood.
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
            <p className="neighborhood-error" role="alert">
              {connectionError}
            </p>
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
                        district={district}
                        players={scenePlayers}
                        selfSessionId={sessionId}
                        homeTypeId={homeTypeId}
                        zoom={zoom}
                        onZoomChange={setZoom}
                        onScene={handleScene}
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
                    {nearbyObject?.kind === "home" && homeTypeId && (
                      <button
                        type="button"
                        className="neighborhood-interaction"
                        disabled={enterHome.isPending}
                        onClick={() => enterHome.mutate()}
                      >
                        <Home size={17} aria-hidden="true" />
                        {enterHome.isPending ? "Opening your home..." : "Enter your home"}
                        <kbd>E</kbd>
                      </button>
                    )}
                  </div>
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
                  <div className="neighborhood-controls-row">
                    <div className="neighborhood-control-copy">
                      <strong>Explore at your pace</strong>
                      <span>WASD or arrow keys · touch controls on mobile</span>
                    </div>
                    <PlayerMovementControls
                      onDirectionChange={setDirections}
                      onFollowChange={(enabled) => scene?.setFollow(enabled)}
                      initialFollowing
                    />
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
