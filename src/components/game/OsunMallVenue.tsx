import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import { OsunMallStreet } from "./OsunMallStreet";
import type { Camera } from "three";
import { MallBubbleLayer } from "./MallBubbleLayer";
import {
  OsunMall3D,
  createMallSim,
  type MallPerson,
  type PlacedProp,
} from "@/components/3d/OsunMall3D";
import type { Appearance } from "@/game/avatar-appearance";
import type { WalkPoint } from "@/game/grid-walk-path";
import { createWalker, type MallWalker } from "@/game/mall-movement";
import { MALL_PROPS, reactionFor, canChatWithShopper, shopperReaction, type MallPropId, type MallTarget } from "@/game/mall-reactions";
import {
  addBubble,
  bubbleTargetFor,
  PLAYER_BUBBLE_ID,
  pruneBubbles,
  type MallBubble,
} from "@/game/mall-bubbles";
import {
  MALL_ENTRANCE,
  canWalkInMall,
  findMallPath,
  restrictedZoneAt,
} from "@/game/osun-mall-layout";
import { q } from "@/lib/game";
import { normalizeEquippedItems } from "@/lib/equipment-service";
import { useOptionalGameTime } from "./GameTimeProvider";
import { gameTimeFromCharacter, INITIAL_GAME_TIME } from "@/lib/game-time";
import { weatherForDay } from "@/lib/world-simulation";
import { mallCrowdTarget, getShopperById } from "@/game/mall-crowd";
import { joinMallRoom } from "@/lib/multiplayer-service";
import { reportMallZone } from "@/lib/osun-mall-presence";

type MallRoomHandle = Awaited<ReturnType<typeof joinMallRoom>>;

/** How many reaction lines to keep on screen. */
const LOG_LENGTH = 3;

/**
 * The Osun Mall you walk around in. The player's walk is checked here for quick feedback, and
 * again on the mall room server, which decides where you are.
 */
export function OsunMallVenue({
  locationId,
  locationName,
}: {
  locationId: string;
  locationName: string;
}) {
  const sim = useRef(createMallSim());
  const roomRef = useRef<MallRoomHandle | null>(null);
  const { data: character } = useQuery(q.character());
  const gameClock = useOptionalGameTime();
  const gameTime = gameClock?.simulation.gameTime ?? (character ? gameTimeFromCharacter(character) : INITIAL_GAME_TIME);
  const crowdTarget = mallCrowdTarget(gameTime, weatherForDay(gameTime.day));
  const { data: equipment } = useQuery(q.equipment());
  const playerEquipment = normalizeEquippedItems(equipment);
  const [status, setStatus] = useState<"joining" | "ready" | "offline">("joining");
  const [message, setMessage] = useState<string | null>(null);
  // Outside, the visitor is on the street; the mall room is only joined while inside.
  const [outside, setOutside] = useState(false);
  const [playerMoving, setPlayerMoving] = useState(false);
  const [people, setPeople] = useState<MallPerson[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [placed, setPlaced] = useState<PlacedProp[]>([]);
  const clicks = useRef(0);
  const [bubbles, setBubbles] = useState<MallBubble[]>([]);
  const nextBubbleId = useRef(1);
  const cameraRef = useRef<Camera | null>(null);

  useEffect(() => {
    if (outside) return undefined;
    let cancelled = false;
    let joined: MallRoomHandle | null = null;
    joinMallRoom(locationId)
      .then((room) => {
        if (cancelled) {
          void room.leave();
          return;
        }
        joined = room;
        roomRef.current = room;
        room.onMessage(
          "presence",
          (data: { people: Array<MallPerson & { sessionId: string }> }) => {
            setPeople(data.people.filter((person) => person.sessionId !== room.sessionId));
          },
        );
        room.onMessage("rejected", (data: { position: WalkPoint; reason: "blocked" | "speed" }) => {
          // The server has a different position: move the player back to it and drop the walk.
          sim.current.player.pos = data.position;
          sim.current.player.walker = null;
          sim.current.player.moving = false;
          setMessage(
            data.reason === "speed"
              ? "You moved too fast. Try the walk again."
              : "That route is not open to you.",
          );
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
      if (joined) void joined.leave();
      roomRef.current = null;
      setPeople([]);
    };
  }, [locationId, outside]);

  // Keep the simulation visitor list synchronized with received multiplayer presence.
  useEffect(() => { sim.current.people = people; }, [people]);

  // The walking state drives the animation, so React sees it a few times a second, not every frame.
  useEffect(() => {
    const timer = window.setInterval(() => setPlayerMoving(sim.current.player.moving), 250);
    return () => window.clearInterval(timer);
  }, []);

  // Bubbles fade out after a few seconds. Pruning returns the same list when nothing expired.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setBubbles((previous) => pruneBubbles(previous, performance.now()));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  // Inside the mall, the server should not accept rides from the street until the visitor leaves.
  useEffect(() => {
    if (outside) return;
    reportMallZone("mall").catch(() => undefined);
  }, [outside]);

  /** Shows one line in a speech bubble above the character it belongs to. */
  const say = (targetId: string, text: string) => {
    const id = nextBubbleId.current;
    nextBubbleId.current += 1;
    const now = performance.now();
    setBubbles((previous) => addBubble(previous, targetId, text, now, id).bubbles);
  };

  const onWalk = (point: WalkPoint) => {
    if (!canWalkInMall(point)) {
      const zone = restrictedZoneAt(point);
      setMessage(zone ? `${zone.label}: staff only.` : "You can't walk there.");
      return;
    }
    const path = findMallPath(sim.current.player.pos, point);
    if (!path) {
      setMessage("No clear route there.");
      return;
    }
    const walker: MallWalker = createWalker(sim.current.player.pos, path);
    sim.current.player.walker = walker;
    setMessage(null);
  };

  const onMove = (point: WalkPoint) => {
    roomRef.current?.send("move", { to: point });
  };

  const onInteract = (target: MallTarget) => {
    const shopper = target.kind === "shopper" ? getShopperById(sim.current.shoppers, target.id) : undefined;
    if (target.kind === "shopper" && (!shopper || !canChatWithShopper(sim.current.player.pos, shopper.walker, shopper.awaitingCheckout === true && shopper.walker.done))) {
      setMessage("Move closer to the shopper to talk.");
      return;
    }
    setMessage(null);
    clicks.current += 1;
    const line = shopper ? shopperReaction(shopper.walker, clicks.current, shopper.awaitingCheckout === true && shopper.walker.done) : reactionFor(target, clicks.current);
    setLog((previous) => [line, ...previous].slice(0, LOG_LENGTH));
    say(bubbleTargetFor(target, sim.current.player.pos), line);
  };

  const placeProp = (id: MallPropId) => {
    if (placed.some((prop) => prop.id === id)) return;
    const position: WalkPoint = [sim.current.player.pos[0], sim.current.player.pos[1]];
    setPlaced((previous) => [...previous, { id, position }]);
    const line = `You put down a ${MALL_PROPS.find((p) => p.id === id)?.label.toLowerCase() ?? "item"}.`;
    setLog((previous) => [line, ...previous].slice(0, LOG_LENGTH));
    say(PLAYER_BUBBLE_ID, line);
  };

  if (outside) {
    const enterMall = () => {
      // Back inside, the visitor starts at the entrance again.
      sim.current.player.pos = [MALL_ENTRANCE[0], MALL_ENTRANCE[1]];
      sim.current.player.walker = null;
      setOutside(false);
    };
    return <OsunMallStreet onEnterMall={enterMall} accent="#c2410c" />;
  }

  return (
    <section className="relative" aria-label={`${locationName} interior`}>
      <div
        data-venue-viewport
        className="relative h-[calc(100dvh-7rem)] min-h-[24rem] overflow-hidden bg-muted"
      >
        <Canvas
          frameloop="always"
          dpr={[1, 1.25]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          camera={{ position: [0, 14, 13], fov: 40 }}
          aria-label="Osun Mall interior. Tap the floor to walk, or tap a shelf, till or person."
        >
          <OsunMall3D
            crowdTarget={crowdTarget}
            sim={sim}
            people={people}
            playerMoving={playerMoving}
            playerGender={character?.gender ?? "nonbinary"}
            playerAppearance={(character?.appearance as Appearance | undefined) ?? {}}
            playerEquipment={playerEquipment}
            placed={placed}
            onWalk={onWalk}
            onMove={onMove}
            onInteract={onInteract}
            cameraRef={cameraRef}
            accent="#c2410c"
          />
        </Canvas>
        <MallBubbleLayer bubbles={bubbles} sim={sim} cameraRef={cameraRef} />
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/85 px-3 py-1 text-xs font-semibold">
          {status === "joining"
            ? "Joining the mall…"
            : status === "offline"
              ? "The mall server is unavailable. You can still look around."
              : "Tap the floor to walk"}
        </div>
      </div>

      {/* Controls sit on the scene, the way the house does: no page chrome around it. */}
      <div className="pointer-events-none absolute right-3 top-3">
        <button
          type="button"
          onClick={() => setOutside(true)}
          className="pointer-events-auto rounded-lg border-2 border-edge bg-background/90 px-3 py-1 text-sm font-semibold"
        >
          Leave mall
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-center gap-2">
        {message && (
          <p
            role="status"
            className="pointer-events-none rounded-md bg-background/90 px-3 py-1 text-sm"
          >
            {message}
          </p>
        )}
        <div
          className="pointer-events-auto flex flex-wrap justify-center gap-2"
          role="group"
          aria-label="Place an item where you stand"
        >
          {MALL_PROPS.map((prop) => {
            const used = placed.some((item) => item.id === prop.id);
            return (
              <button
                key={prop.id}
                type="button"
                disabled={used}
                onClick={() => placeProp(prop.id)}
                className="rounded-lg border-2 border-edge bg-background/90 px-3 py-1 text-sm font-semibold disabled:opacity-50"
              >
                {used ? `${prop.label} placed` : `Place ${prop.label.toLowerCase()}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reactions are announced to screen readers; the speech bubbles show them visually. */}
      <ol className="sr-only" aria-label="Reactions" aria-live="polite">
        {log.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
