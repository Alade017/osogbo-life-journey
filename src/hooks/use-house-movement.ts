import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomPoint } from "@/game/house-navigation";
export function useHouseMovement(resetKey: string, initial: RoomPoint) {
  const [position, setPosition] = useState<RoomPoint>(initial),
    [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<"north" | "south" | "east" | "west">("south");
  const current = useRef(position),
    frame = useRef(0),
    resolve = useRef<((arrived: boolean) => void) | null>(null);
  const cancel = useCallback(() => {
    cancelAnimationFrame(frame.current);
    resolve.current?.(false);
    resolve.current = null;
    setWalking(false);
  }, []);
  useEffect(() => {
    cancel();
    current.current = initial;
    setPosition(initial);
    return cancel;
  }, [resetKey, cancel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const stop = () => {
      if (document.hidden || !navigator.onLine) cancel();
    };
    document.addEventListener("visibilitychange", stop);
    window.addEventListener("offline", stop);
    return () => {
      document.removeEventListener("visibilitychange", stop);
      window.removeEventListener("offline", stop);
    };
  }, [cancel]);
  const walk = useCallback(
    (path: RoomPoint[]) => {
      cancel();
      setWalking(true);
      return new Promise<boolean>((done) => {
        resolve.current = done;
        let segment = 0,
          last = performance.now(),
          paint = 0;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const tick = (now: number) => {
          let remaining = Math.min(0.08, (now - last) / 1000) * 2.2;
          last = now;
          while (segment < path.length) {
            const to = path[segment]!,
              from = current.current,
              dx = to[0] - from[0],
              dz = to[2] - from[2],
              distance = Math.hypot(dx, dz);
            if (distance <= remaining || reduced) {
              current.current = to;
              remaining -= distance;
              segment++;
              continue;
            }
            setFacing(
              Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "east" : "west") : dz > 0 ? "south" : "north",
            );
            current.current = [
              from[0] + (dx / distance) * remaining,
              0.06,
              from[2] + (dz / distance) * remaining,
            ];
            break;
          }
          if (now - paint >= 33 || segment === path.length) {
            setPosition([...current.current]);
            paint = now;
          }
          if (segment === path.length) {
            setWalking(false);
            resolve.current = null;
            done(true);
          } else frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
      });
    },
    [cancel],
  );
  return { position, positionRef: current, walking, facing, walk, cancel };
}
