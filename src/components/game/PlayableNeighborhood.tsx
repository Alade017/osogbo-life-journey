import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Map, Minus, Plus } from "lucide-react";
import { PlayerMovementControls } from "@/components/game/PlayerMovementControls";
import { joinNeighborhood, type NeighborhoodRoom } from "@/lib/multiplayer-service";
import { q } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import { canonicalHomeOptions } from "@/lib/living-cost-service";
import type { NetworkPlayerSnapshot } from "@/game/multiplayer-state";
import { neighborhoodAreaForSlug, nearestInteraction, toScene } from "@/game/neighborhood-model";
import type { NeighborhoodPlayerView, PhaserNeighborhoodHandle } from "@/game/phaser-neighborhood";
import type { MovementDirection } from "@/lib/player-movement";
import "@/components/game/neighborhood.css";

type ConnectionState = "loading" | "connecting" | "connected" | "unavailable" | "wrong-area";

const CITY_CENTRE_ORIGIN = { x: 7, y: 6 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function playerViewsFromRoom(room: NeighborhoodRoom): NeighborhoodPlayerView[] {
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
  const roomRef = useRef<NeighborhoodRoom | null>(null);

  useEffect(() => {
    if (!locationId || !slug) {
      setConnectionState("unavailable");
      setConnectionError(
        "Your saved world location could not be resolved. Return to the city map.",
      );
      return;
    }
    if (slug !== "city-centre") {
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
        const publish = () => setPlayers(playerViewsFromRoom(room));
        publish();
        room.onStateChange(publish);
        room.onLeave((code) => {
          if (!active) return;
          roomRef.current = null;
          setConnectionState("unavailable");
          setConnectionError(
            `The neighborhood connection closed (${code}). Reconnect to continue.`,
          );
        });
        setConnectionState("connected");
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

  return { connectionState, connectionError, players, sessionId, roomRef };
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

function PhaserNeighborhoodSurface({
  players,
  selfSessionId,
  homeTypeId,
  onScene,
}: {
  players: readonly NeighborhoodPlayerView[];
  selfSessionId: string;
  homeTypeId: string | null;
  onScene: (scene: PhaserNeighborhoodHandle | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneRef = useRef<PhaserNeighborhoodHandle | null>(null);
  const playersRef = useRef(players);
  const [rendererError, setRendererError] = useState("");
  playersRef.current = players;
  const area = neighborhoodAreaForSlug("city-centre");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let active = true;
    void import("@/game/phaser-neighborhood")
      .then(({ createPhaserNeighborhood }) => {
        if (!active) return;
        const game = createPhaserNeighborhood({
          host,
          area,
          selfSessionId,
          homeTypeId,
          playersRef,
          onReady: () => undefined,
          onScene: (scene) => {
            if (!active) return;
            sceneRef.current = scene;
            onScene(scene);
            scene.setPlayers(playersRef.current);
          },
        });
        if (!active) {
          game.destroy(true);
          return;
        }
        gameRef.current = game;
      })
      .catch((error: unknown) => {
        if (active) {
          setRendererError(
            error instanceof Error
              ? error.message
              : "The playable neighborhood renderer could not start.",
          );
          console.error("The playable neighborhood renderer could not start.", error);
        }
      });

    return () => {
      active = false;
      onScene(null);
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      host.replaceChildren();
    };
  }, [area, homeTypeId, onScene, selfSessionId]);

  useEffect(() => {
    sceneRef.current?.setPlayers(players);
  }, [players]);

  return (
    <>
      <div className="playable-neighborhood-canvas" ref={hostRef} aria-hidden="true" />
      {rendererError && (
        <p className="neighborhood-renderer-error" role="alert">
          The neighborhood could not be drawn: {rendererError}
        </p>
      )}
    </>
  );
}

export function PlayableNeighborhood() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const characterQuery = useQuery(q.character());
  const locationsQuery = useQuery({
    ...q.locations(),
    enabled: !!characterQuery.data?.current_location_id,
  });
  const currentLocation = locationsQuery.data?.find(
    (location) => location.id === characterQuery.data?.current_location_id,
  );
  const homeQuery = useQuery({
    ...canonicalHomeOptions(characterQuery.data?.id),
    enabled: !!characterQuery.data?.id && currentLocation?.slug === "city-centre",
  });
  const homeTypeId = homeTypeFromRecord(homeQuery.data);
  const { connectionState, connectionError, players, sessionId, roomRef } =
    useNeighborhoodConnection(currentLocation?.id, currentLocation?.slug);
  const [directions, setDirections] = useState<ReadonlySet<MovementDirection>>(() => new Set());
  const [scene, setScene] = useState<PhaserNeighborhoodHandle | null>(null);
  const [zoom, setZoom] = useState(0.65);
  const directionsRef = useRef(directions);
  directionsRef.current = directions;
  const lastIntentRef = useRef("0:0");
  const area = neighborhoodAreaForSlug("city-centre");
  const player = players.find((candidate) => candidate.sessionId === sessionId);
  const nearbyObject = useMemo(() => {
    if (!player) return null;
    const point = toScene({ x: player.x, y: player.y }, CITY_CENTRE_ORIGIN);
    return nearestInteraction(point, area.objects);
  }, [area.objects, player]);

  const enterHome = useMutation({
    mutationFn: async () => {
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
    scene?.setZoom(factor);
    setZoom((current) => Math.min(0.9, Math.max(0.42, current * factor)));
  };

  if (characterQuery.isLoading || locationsQuery.isLoading)
    return (
      <section className="neighborhood-page" aria-label="Playable neighborhood">
        <p role="status">Loading your saved character and location...</p>
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
          <h1>Olaiya neighbourhood</h1>
          <p>Walk the crossing, residential compounds and local shopfronts.</p>
        </div>
        <Link className="neighborhood-map-link" to="/map">
          <Map size={17} aria-hidden="true" /> City map
        </Link>
      </header>

      {connectionState === "wrong-area" ? (
        <div className="neighborhood-message" role="status">
          <strong>Olaiya is not your current location.</strong>
          <span>
            Use your home&apos;s outside exit to arrive in Olaiya, or travel to Central Crossing.
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
          {connectionState === "connected" &&
            (homeQuery.isLoading ? (
              <p className="neighborhood-loading">Checking the home entrance...</p>
            ) : (
              sessionId && (
                <>
                  <div className="neighborhood-stage">
                    <PhaserNeighborhoodSurface
                      players={players}
                      selfSessionId={sessionId}
                      homeTypeId={homeTypeId}
                      onScene={handleScene}
                    />
                    <div
                      className="neighborhood-zoom-controls"
                      aria-label="Neighborhood camera controls"
                    >
                      <button type="button" aria-label="Zoom in" onClick={() => changeZoom(1.12)}>
                        <Plus size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Zoom out"
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
                  {homeQuery.isError && (
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
