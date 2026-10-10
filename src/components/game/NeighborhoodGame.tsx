import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientOnlyFn } from "@tanstack/react-start";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Compass, Minus, Plus } from "lucide-react";
import { q, rpc, type Location, formatNaira } from "@/lib/game";
import {
  estimateTrip,
  getAvailableTravelModes,
  TRAVEL_MODE_DETAILS,
  type TravelMode,
} from "@/lib/transport-service";
import { cityEntranceForRecord } from "@/lib/city-world";
import {
  neighborhoodAreaOrigin,
  neighborhoodAreaForSlug,
  type NeighborhoodObject,
  type WorldPoint,
} from "@/game/neighborhood-model";
import type { NetworkPlayerSnapshot } from "@/game/multiplayer-state";
import type { createNeighborhoodGame, MovementInput } from "@/game/neighborhood-scene";
import { joinNeighborhood, type NeighborhoodRoom } from "@/lib/multiplayer-service";
import { useGameTime } from "./GameTimeProvider";
import "./neighborhood.css";

type Engine = ReturnType<typeof createNeighborhoodGame>;
const loadNeighborhood = createClientOnlyFn(() => import("@/game/neighborhood-scene"));
const controls = [
  { direction: "up", Icon: ArrowUp, label: "Walk north" },
  { direction: "left", Icon: ArrowLeft, label: "Walk west" },
  { direction: "down", Icon: ArrowDown, label: "Walk south" },
  { direction: "right", Icon: ArrowRight, label: "Walk east" },
] as const;

export function NeighborhoodGame() {
  const { data: character } = useQuery(q.character());
  const locations = useQuery(q.locations());
  const current = locations.data?.find(
    (location) => location.id === character?.current_location_id,
  );
  const area = neighborhoodAreaForSlug(current?.slug);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { reconnect } = useGameTime();
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const roomRef = useRef<NeighborhoodRoom | null>(null);
  const confirmed = useRef<WorldPoint>({ x: 7, y: 6 });
  const revision = useRef(0);
  const pending = useRef(false);
  const [nearby, setNearby] = useState<NeighborhoodObject | null>(null);
  const [dialogue, setDialogue] = useState(false);
  const [directory, setDirectory] = useState(false);
  const [destinationId, setDestinationId] = useState("");
  const destination = locations.data?.find((location) => location.id === destinationId);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [multiplayerStatus, setMultiplayerStatus] = useState<
    "connecting" | "connected" | "error" | "disconnected"
  >("connecting");
  const [status, setStatus] = useState("Walk with WASD or arrows. Tap the street to move.");
  const menuOpen = useRef(false);
  menuOpen.current = dialogue || directory;
  useEffect(() => {
    engine.current?.scene.lock(
      busy ||
        dialogue ||
        directory ||
        multiplayerStatus !== "connected" ||
        !navigator.onLine ||
        document.hidden,
    );
  }, [busy, dialogue, directory, loaded, multiplayerStatus]);
  const callbacks = useRef({
    checkpoint: async (_point: WorldPoint) => false,
    interact: (_object: NeighborhoodObject) => {},
    playerSelected: (_player: NetworkPlayerSnapshot) => {},
    playerTooFar: (_name: string) => {},
    movement: (_input: { x: number; y: number }) => {},
  });
  const checkpoint = async (point: WorldPoint) => {
    if (!character || pending.current) return false;
    if (Math.hypot(point.x - confirmed.current.x, point.y - confirmed.current.y) < 0.01)
      return true;
    pending.current = true;
    engine.current?.scene.lock(true);
    setBusy(true);
    setStatus("Saving your walk…");
    try {
      const result = await rpc.savePlayerWorldPosition({
        worldX: point.x,
        worldY: point.y,
        buildingSlug: null,
        expectedRevision: revision.current,
        requestId: crypto.randomUUID(),
      });
      if (
        !result ||
        typeof result !== "object" ||
        Array.isArray(result) ||
        typeof result["revision"] !== "number"
      )
        throw new Error("The server did not confirm this checkpoint.");
      confirmed.current = point;
      revision.current = result["revision"];
      await qc.invalidateQueries({ queryKey: ["character"] });
      reconnect();
      setStatus("Walk saved. Your next opportunity is around the corner.");
      return true;
    } catch (error) {
      engine.current?.scene.restore(confirmed.current);
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not save. Returned to your last saved position.",
      );
      // Refresh the authoritative checkpoint after a revision conflict or lost response.
      await qc.invalidateQueries({ queryKey: ["character"] });
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
      engine.current?.scene.restore(confirmed.current);
      engine.current?.scene.lock(
        multiplayerStatus !== "connected" || !navigator.onLine || document.hidden,
      );
    }
  };
  callbacks.current = {
    checkpoint,
    movement: (input) => roomRef.current?.send("move", input),
    playerSelected: (player) => {
      void navigate({ to: "/social", search: { playerId: player.characterId } });
    },
    playerTooFar: (name) => setStatus("Move closer to " + name + " to view their profile."),
    interact: (object) => {
      if (object.kind === "npc") {
        setDialogue(true);
        return;
      }
      const active = engine.current;
      if (!active || pending.current) return;
      // Interaction checkpoints use the live scene coordinates through its checkpoint method.
      void active.scene.checkpoint().then((saved) => {
        if (!saved) return;
        void navigate({
          to: object.kind === "home" ? "/home" : object.kind === "market" ? "/market" : "/jobs",
        });
      });
    },
  };
  const worldX = character?.world_x;
  const worldY = character?.world_y;
  const worldRevision = character?.world_position_revision;
  useEffect(() => {
    if (worldX === undefined || worldY === undefined || worldRevision === undefined) return;
    const point = { x: worldX, y: worldY };
    confirmed.current = point;
    revision.current = worldRevision;
    if (!pending.current) engine.current?.scene.restore(point);
  }, [worldX, worldY, worldRevision]);

  const characterId = character?.id;
  async function travel(destination: Location, mode: TravelMode) {
    if (pending.current || !engine.current) return;
    if (!(await engine.current.scene.checkpoint())) return;
    pending.current = true;
    setBusy(true);
    engine.current.scene.lock(true);
    try {
      const point = cityEntranceForRecord(destination);
      await rpc.travelToCityLocation({
        locationId: destination.id,
        mode,
        worldX: point.x,
        worldY: point.y,
        expectedRevision: revision.current,
        requestId: crypto.randomUUID(),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["character"] }),
        qc.invalidateQueries({ queryKey: ["wallet"] }),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      setDirectory(false);
      setStatus(`Arrived at ${destination.name}.`);
      reconnect();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not complete this trip.");
      await qc.invalidateQueries({ queryKey: ["character"] });
    } finally {
      pending.current = false;
      setBusy(false);
      engine.current?.scene.restore(confirmed.current);
      engine.current?.scene.lock(
        multiplayerStatus !== "connected" || !navigator.onLine || document.hidden,
      );
    }
  }
  const locationId = current?.id;
  useEffect(() => {
    if (!host.current || !characterId || locations.isPending || locations.isError) return;
    let cancelled = false;
    let created: Engine | null = null;
    setLoaded(false);
    setLoadError("");
    const entrance = current ? cityEntranceForRecord(current) : confirmed.current;
    const origin = neighborhoodAreaOrigin(entrance);
    loadNeighborhood()
      .then(({ createNeighborhoodGame: create }) => {
        if (cancelled || !host.current) return;
        created = create(host.current, {
          origin,
          spawn: confirmed.current,
          area,
          onNearby: setNearby,
          onCheckpoint: (point) => {
            void callbacks.current.checkpoint(point);
          },
          onPlayerSelected: (player) => callbacks.current.playerSelected(player),
          onPlayerTooFar: (name) => callbacks.current.playerTooFar(name),
          onInteract: (object) => callbacks.current.interact(object),
          saveCheckpoint: (point) => callbacks.current.checkpoint(point),
          onMovementIntent: (input) => callbacks.current.movement(input),
        });
        engine.current = created;
        setLoaded(true);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoadError(
            error instanceof Error ? error.message : "Could not start the neighborhood.",
          );
      });
    const onVisibility = () => {
      engine.current?.scene.lock(
        document.hidden ||
          !navigator.onLine ||
          pending.current ||
          menuOpen.current ||
          multiplayerStatus !== "connected",
      );
      if (!navigator.onLine) setStatus("Offline. Movement is paused until you reconnect.");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("offline", onVisibility);
    window.addEventListener("online", onVisibility);
    return () => {
      cancelled = true;
      created?.game.destroy(true);
      engine.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("offline", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
    // Snapshot changes restore the scene above; only district changes rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, locationId, locations.isPending, locations.isError, retry]);

  useEffect(() => {
    if (!loaded || !locationId || !engine.current) return;
    let cancelled = false;
    let joined: NeighborhoodRoom | null = null;
    setMultiplayerStatus("connecting");
    engine.current.scene.lock(true);

    void joinNeighborhood(locationId)
      .then((room) => {
        if (cancelled) {
          void room.leave();
          return;
        }
        joined = room;
        roomRef.current = room;
        engine.current?.scene.setLocalSessionId(room.sessionId);
        const syncPlayers = () => {
          const snapshots = Array.from(
            room.state.players.entries() as Iterable<[string, NetworkPlayerSnapshot]>,
            ([sessionId, player]) => ({ sessionId, ...player }),
          );
          engine.current?.scene.syncNetworkPlayers(snapshots);
        };
        room.state.players.onAdd(syncPlayers);
        room.state.players.onChange(syncPlayers);
        room.state.players.onRemove(syncPlayers);
        syncPlayers();
        room.onLeave((_code, reason) => {
          if (cancelled) return;
          roomRef.current = null;
          engine.current?.scene.setLocalSessionId(null);
          engine.current?.scene.syncNetworkPlayers([]);
          engine.current?.scene.lock(true);
          setMultiplayerStatus("disconnected");
          setStatus(
            reason || "Connection lost. Reconnect to rejoin from your last saved checkpoint.",
          );
        });
        setMultiplayerStatus("connected");
        setStatus("Connected to your neighborhood. Other players here are real players.");
        engine.current?.scene.lock(
          !navigator.onLine || document.hidden || pending.current || menuOpen.current,
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMultiplayerStatus("error");
        setStatus(error instanceof Error ? error.message : "Could not connect to the game server.");
      });

    return () => {
      cancelled = true;
      if (roomRef.current === joined) roomRef.current = null;
      engine.current?.scene.setLocalSessionId(null);
      engine.current?.scene.syncNetworkPlayers([]);
      if (joined) void joined.leave();
    };
  }, [loaded, locationId, connectionAttempt]);

  const touch = (direction: MovementInput, pressed: boolean) =>
    engine.current?.scene.setTouch(direction, pressed);
  return (
    <section className="neighborhood" aria-label="Playable Osogbo neighborhood">
      <header className="neighborhood-head">
        <div>
          <p className="neighborhood-eyebrow">
            <Compass size={14} /> YOUR NEIGHBOURHOOD
          </p>
          <h1>{current?.name ?? "Olaiya Quarter"}</h1>
          <p>Meet your neighbours. Find your next shift. Make this place your own.</p>
        </div>
        <div className="neighborhood-links">
          <button onClick={() => setDirectory((value) => !value)}>Districts</button>
          <Link to="/jobs">Find work</Link>
          <Link to="/inventory">Your bag</Link>
          <Link to="/home" search={{ visit: undefined }}>
            Go home
          </Link>
        </div>
      </header>
      <div className="neighborhood-stage">
        {directory && (
          <div
            className="neighborhood-directory"
            role="dialog"
            aria-label="City district directory"
          >
            <div>
              <strong>Where are you heading?</strong>
              <button onClick={() => setDirectory(false)} aria-label="Close district directory">
                Close
              </button>
            </div>
            <select
              aria-label="Choose district"
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
            >
              <option value="">Choose a destination</option>
              {locations.data
                ?.filter((location) => location.is_active && location.id !== current?.id)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
            </select>
            {destination && (
              <div className="neighborhood-trips">
                {getAvailableTravelModes(destination.metadata).map((mode) => {
                  const trip = estimateTrip(
                    mode,
                    destination.travel_fare ?? 150,
                    Math.max(
                      8,
                      Math.ceil(
                        Math.hypot(
                          confirmed.current.x - cityEntranceForRecord(destination).x,
                          confirmed.current.y - cityEntranceForRecord(destination).y,
                        ) * 4,
                      ),
                    ),
                  );
                  return (
                    <button
                      key={mode}
                      disabled={busy}
                      onClick={() => void travel(destination, mode)}
                    >
                      <strong>{TRAVEL_MODE_DETAILS[mode].label}</strong>
                      <span>
                        {formatNaira(trip.fare)} · ~{trip.minutes} min
                      </span>
                    </button>
                  );
                })}
                <p>Estimated fare and time. Your trip is validated before payment.</p>
              </div>
            )}
          </div>
        )}
        <div
          ref={host}
          className="neighborhood-canvas"
          role="application"
          aria-label="City world. Arrow keys or WASD to walk; E to interact."
          tabIndex={0}
        />
        {!loaded && !loadError && (
          <div className="neighborhood-loading" aria-live="polite">
            Preparing your neighbourhood…
          </div>
        )}
        {(loadError || locations.isError) && (
          <div className="neighborhood-loading" role="alert">
            <p>{loadError || "Could not load the city."}</p>
            <button
              onClick={() => {
                setRetry((value) => value + 1);
                void locations.refetch();
              }}
            >
              Try again
            </button>
          </div>
        )}
        {loaded && multiplayerStatus !== "connected" && !loadError && !locations.isError && (
          <div className="neighborhood-loading" aria-live="polite">
            <p>
              {multiplayerStatus === "connecting"
                ? "Connecting to the shared neighborhood…"
                : status}
            </p>
            {multiplayerStatus !== "connecting" && (
              <button onClick={() => setConnectionAttempt((value) => value + 1)}>Reconnect</button>
            )}
          </div>
        )}
        <div className="neighborhood-zoom">
          <button aria-label="Zoom out" onClick={() => engine.current?.scene.zoom(-0.15)}>
            <Minus size={18} />
          </button>
          <button aria-label="Zoom in" onClick={() => engine.current?.scene.zoom(0.15)}>
            <Plus size={18} />
          </button>
        </div>
        <div className="neighborhood-pad" aria-label="Touch movement controls">
          {controls.map(({ direction, Icon, label }) => (
            <button
              key={direction}
              aria-label={label}
              disabled={busy || !loaded || multiplayerStatus !== "connected"}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                touch(direction, true);
              }}
              onPointerUp={() => touch(direction, false)}
              onPointerCancel={() => touch(direction, false)}
              onLostPointerCapture={() => touch(direction, false)}
            >
              <Icon size={22} />
            </button>
          ))}
        </div>
        {nearby && (
          <button
            className="neighborhood-interact"
            disabled={busy || multiplayerStatus !== "connected"}
            onClick={() => engine.current?.scene.interact()}
          >
            {nearby.kind === "npc"
              ? `Talk to ${nearby.name.split(" · ")[0]}`
              : `Enter ${nearby.name}`}
            <span>E / tap</span>
          </button>
        )}
        {dialogue && (
          <div
            className="neighborhood-dialogue"
            role="dialog"
            aria-modal="false"
            aria-label={`Talk to ${nearby?.name ?? "your neighbour"}`}
          >
            <strong>{nearby?.name ?? "Your neighbour"}</strong>
            <p>
              Ẹ káàbọ̀! Start with a shift nearby, pick up something to eat, then head home to
              recharge. You’ll find your rhythm here.
            </p>
            <Link to="/social" search={{ playerId: undefined }}>
              Meet people
            </Link>
            <button onClick={() => setDialogue(false)}>Back to the street</button>
          </div>
        )}
      </div>
      <footer className="neighborhood-footer">
        <p role="status">{status}</p>
        <span>Explore → Work → Upgrade → Rest</span>
      </footer>
    </section>
  );
}
