import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Color } from "three";
import { useOptionalGameTime } from "@/components/game/GameTimeProvider";
import { WORLD_PALETTE } from "../3d/world-theme";

const DAY_BACKGROUND = new Color(WORLD_PALETTE.ground);
const NIGHT_BACKGROUND = new Color("#0b1220"); // Atmospheric deep Osogbo midnight navy
const DAY_AMBIENT = new Color("#ffffff");
const NIGHT_AMBIENT = new Color("#253654"); // Moonlit blue ambient

/**
 * Converts a clock time into a sun arc and a 0–1 daylight amount.
 * The sun rises at 06:00, peaks at 12:00 and sets at 18:30, with a rich dusk band.
 */
export function daylightFor(hour: number, minute = 0) {
  const t = (((hour % 24) + 24) % 24) + minute / 60;
  const arc = ((t - 6) / 12) * Math.PI;
  const elevation = Math.sin(arc);
  const day = Math.min(1, Math.max(0, (elevation + 0.12) / 0.4));
  return { t, arc, day, isNight: day < 0.35 };
}

/** Reads real-world local time or active game simulation clock. */
export function useRealOrGameClock(): { hour: number; minute: number; isRealTime: boolean } {
  const game = useOptionalGameTime();
  const [realClock, setRealClock] = useState(() => {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  });

  useEffect(() => {
    // Keep in sync with real-world time ticking
    const interval = setInterval(() => {
      const now = new Date();
      setRealClock({ hour: now.getHours(), minute: now.getMinutes() });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (game?.simulation?.gameTime) {
    return {
      hour: game.simulation.gameTime.hour,
      minute: game.simulation.gameTime.minute,
      isRealTime: false,
    };
  }

  return { ...realClock, isRealTime: true };
}

/**
 * Real-time dynamic day and night lighting for the 3D town map.
 * Synchronizes with real local time (or game clock), smoothly altering
 * sunlight elevation, nighttime moonlight, shadows, and ambient tint.
 */
export function MapLighting({ size = 30 }: { size?: number }) {
  const clock = useRealOrGameClock();
  const invalidate = useThree((state) => state.invalidate);
  const { hour, minute } = clock;
  const { arc, day, isNight } = daylightFor(hour, minute);

  const background = useMemo(() => NIGHT_BACKGROUND.clone().lerp(DAY_BACKGROUND, day), [day]);
  const ambientColor = useMemo(() => NIGHT_AMBIENT.clone().lerp(DAY_AMBIENT, day), [day]);

  const sunPosition: [number, number, number] = [
    -Math.cos(arc) * size * 0.9,
    Math.max(Math.sin(arc), 0.2) * size,
    size * 0.4,
  ];

  useEffect(() => {
    invalidate();
  }, [invalidate, hour, minute]);

  return (
    <>
      <color attach="background" args={[background]} />
      <ambientLight color={ambientColor} intensity={isNight ? 0.8 : 0.95 + 0.6 * day} />

      {/* Sun Light (Daytime) */}
      <directionalLight
        position={sunPosition}
        color={ambientColor}
        intensity={0.15 + 1.35 * day}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
      />

      {/* Soft Moon Light (Nighttime) */}
      {isNight && (
        <directionalLight
          position={[size * 0.6, size * 0.9, -size * 0.4]}
          color="#93c5fd"
          intensity={0.65}
        />
      )}
    </>
  );
}
