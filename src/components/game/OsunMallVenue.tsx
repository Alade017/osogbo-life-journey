import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OsunMall3D, createMallSim, type MallPerson } from "@/components/3d/OsunMall3D";
import type { WalkPoint } from "@/game/grid-walk-path";
import { createWalker, type MallWalker } from "@/game/mall-movement";
import {
  canWalkInMall,
  findMallPath,
  restrictedZoneAt,
} from "@/game/osun-mall-layout";
import { joinMallRoom } from "@/lib/multiplayer-service";

type MallRoomHandle = Awaited<ReturnType<typeof joinMallRoom>>;

/**
 * The Osun Mall you walk around in. The player's walk is checked here, on the client, for quick
 * feedback, and again on the mall room server, which is the one that decides where you are.
 */
export function OsunMallVenue({ locationId, locationName }: { locationId: string; locationName: string }) {
  const sim = useRef(createMallSim());
  const roomRef = useRef<MallRoomHandle | null>(null);
  const [status, setStatus] = useState<"joining" | "ready" | "offline">("joining");
  const [message, setMessage] = useState<string | null>(null);
  const [playerMoving, setPlayerMoving] = useState(false);
  const [people, setPeople] = useState<MallPerson[]>([]);

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
        room.onMessage("presence", (data: { people: Array<MallPerson & { sessionId: string }> }) => {
          const others = data.people.filter((person) => person.sessionId !== room.sessionId);
          setPeople(others);
        });
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

  // Keep the walking state for the animation in React, updated a few times a second.
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

  return (
    <section className="space-y-2" aria-label={`${locationName} interior`}>
      <div className="relative h-80 overflow-hidden rounded-lg border border-edge bg-muted sm:h-[28rem]">
        <Canvas
          frameloop="always"
          dpr={[1, 1.25]}
          gl={{ antialias: false, powerPreference: "low-power" }}
          camera={{ position: [0, 9, 10], fov: 40 }}
          aria-label="Osun Mall interior. Tap the floor to walk."
        >
          <OsunMall3D
            sim={sim}
            people={people}
            playerMoving={playerMoving}
            onWalk={onWalk}
            onMove={onMove}
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
    </section>
  );
}
