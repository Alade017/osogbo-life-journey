import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import {
  OsunMall3D,
  createMallSim,
  type MallPerson,
  type PlacedProp,
} from "@/components/3d/OsunMall3D";
import type { Appearance } from "@/game/avatar-appearance";
import type { WalkPoint } from "@/game/grid-walk-path";
import { createWalker, type MallWalker } from "@/game/mall-movement";
import { MALL_PROPS, reactionFor, type MallPropId, type MallTarget } from "@/game/mall-reactions";
import { canWalkInMall, findMallPath, restrictedZoneAt } from "@/game/osun-mall-layout";
import { q } from "@/lib/game";
import { joinMallRoom } from "@/lib/multiplayer-service";

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
  const [status, setStatus] = useState<"joining" | "ready" | "offline">("joining");
  const [message, setMessage] = useState<string | null>(null);
  const [playerMoving, setPlayerMoving] = useState(false);
  const [people, setPeople] = useState<MallPerson[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [placed, setPlaced] = useState<PlacedProp[]>([]);
  const clicks = useRef(0);

  useEffect(() => {
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
        room.onMessage("rejected", (data: { position: WalkPoint }) => {
          // The server has a different position: move the player back to it and drop the walk.
          sim.current.player.pos = data.position;
          sim.current.player.walker = null;
          sim.current.player.moving = false;
          setMessage("That route is not open to you.");
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
    };
  }, [locationId]);

  // The walking state drives the animation, so React sees it a few times a second, not every frame.
  useEffect(() => {
    const timer = window.setInterval(() => setPlayerMoving(sim.current.player.moving), 250);
    return () => window.clearInterval(timer);
  }, []);

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
    clicks.current += 1;
    const line = reactionFor(target, clicks.current);
    setLog((previous) => [line, ...previous].slice(0, LOG_LENGTH));
  };

  const placeProp = (id: MallPropId) => {
    if (placed.some((prop) => prop.id === id)) return;
    const position: WalkPoint = [sim.current.player.pos[0], sim.current.player.pos[1]];
    setPlaced((previous) => [...previous, { id, position }]);
    setLog((previous) =>
      [
        `You put down a ${MALL_PROPS.find((p) => p.id === id)?.label.toLowerCase() ?? "item"}.`,
        ...previous,
      ].slice(0, LOG_LENGTH),
    );
  };

  return (
    <section className="space-y-2" aria-label={`${locationName} interior`}>
      <div className="relative h-80 overflow-hidden rounded-lg border border-edge bg-muted sm:h-[28rem]">
        <Canvas
          frameloop="always"
          dpr={[1, 1.25]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          camera={{ position: [0, 14, 13], fov: 40 }}
          aria-label="Osun Mall interior. Tap the floor to walk, or tap a shelf, till or person."
        >
          <OsunMall3D
            sim={sim}
            people={people}
            playerMoving={playerMoving}
            playerGender={character?.gender ?? "nonbinary"}
            playerAppearance={(character?.appearance as Appearance | undefined) ?? {}}
            placed={placed}
            onWalk={onWalk}
            onMove={onMove}
            onInteract={onInteract}
            accent="#c2410c"
          />
        </Canvas>
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/85 px-3 py-1 text-xs font-semibold">
          {status === "joining"
            ? "Joining the mall…"
            : status === "offline"
              ? "The mall server is unavailable. You can still look around."
              : "Tap the floor to walk"}
        </div>
      </div>

      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Place an item where you stand">
        {MALL_PROPS.map((prop) => {
          const used = placed.some((item) => item.id === prop.id);
          return (
            <button
              key={prop.id}
              type="button"
              disabled={used}
              onClick={() => placeProp(prop.id)}
              className="rounded-lg border-2 border-edge px-3 py-1 text-sm font-semibold disabled:opacity-50"
            >
              {used ? `${prop.label} placed` : `Place ${prop.label.toLowerCase()}`}
            </button>
          );
        })}
      </div>

      <ol className="space-y-1 text-sm" aria-label="Reactions" aria-live="polite">
        {log.map((line, index) => (
          <li key={`${index}-${line}`} className="text-muted-foreground">
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}
