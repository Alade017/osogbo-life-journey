import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomPoint } from "@/game/house-navigation";

const POSITION_KEY_PREFIX = "osun:house:position:";

/** Last resting spot in a house, kept per house for this browser tab so a refresh resumes there. */
function readSavedPosition(houseKey: string): RoomPoint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(POSITION_KEY_PREFIX + houseKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      Array.isArray(value) &&
      value.length === 3 &&
      value.every((part) => typeof part === "number" && Number.isFinite(part))
    )
      return [value[0], value[1], value[2]] as RoomPoint;
    return null;
  } catch {
    return null;
  }
}

function savePosition(houseKey: string, point: RoomPoint): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(POSITION_KEY_PREFIX + houseKey, JSON.stringify(point));
  } catch {
    // Storage can be full or disabled; the character then simply starts at the default spot.
  }
}

export function useHouseMovement(resetKey: string, initial: RoomPoint) {
  const [position, setPosition] = useState<RoomPoint>(() => readSavedPosition(resetKey) ?? initial);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<"north" | "south" | "east" | "west">("south");
  const current = useRef(position),
    frame = useRef(0),
    resolve = useRef<((arrived: boolean) => void) | null>(null),
    houseKey = useRef(resetKey);
  houseKey.current = resetKey;
  const cancel = useCallback(() => {
    cancelAnimationFrame(frame.current);
    resolve.current?.(false);
    resolve.current = null;
    savePosition(houseKey.current, current.current);
    setWalking(false);
  }, []);
  useEffect(() => {
    cancel();
    const start = readSavedPosition(resetKey) ?? initial;
    current.current = start;
    setPosition(start);
    return cancel;
  }, [resetKey, cancel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const save = () => savePosition(houseKey.current, current.current);
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, []);
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
              dy = to[1] - from[1],
              distance = Math.hypot(dx, dy, dz);
            if (Math.hypot(dx, dz) > 0.001) {
              setFacing(
                Math.abs(dx) > Math.abs(dz)
                  ? dx > 0
                    ? "east"
                    : "west"
                  : dz > 0
                    ? "south"
                    : "north",
              );
            }
            if (distance <= remaining || reduced) {
              current.current = to;
              remaining -= distance;
              segment++;
              continue;
            }
            current.current = [
              from[0] + (dx / distance) * remaining,
              from[1] + (dy / distance) * remaining,
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
            savePosition(houseKey.current, current.current);
            done(true);
          } else frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
      });
    },
    [cancel],
  );
  /** Puts the character at a point without walking, e.g. just inside the door when entering. */
  const place = useCallback(
    (point: RoomPoint) => {
      cancel();
      current.current = point;
      savePosition(houseKey.current, point);
      setPosition(point);
    },
    [cancel],
  );
  return { position, positionRef: current, walking, facing, walk, cancel, place };
}
