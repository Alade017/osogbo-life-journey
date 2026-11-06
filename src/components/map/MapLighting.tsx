import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { Color } from "three";
import { useOptionalGameTime } from "@/components/game/GameTimeProvider";
import { WORLD_PALETTE } from "../3d/world-theme";

const DAY_BACKGROUND = new Color(WORLD_PALETTE.ground);
const NIGHT_BACKGROUND = new Color("#34495f");
const DAY_AMBIENT = new Color("#ffffff");
const NIGHT_AMBIENT = new Color("#b4c6e0");

/**
 * Converts a game clock time into a sun arc and a 0–1 daylight amount.
 * The sun rises at 06:00, peaks at 12:00 and sets at 18:00, with a soft dusk band.
 */
export function daylightFor(hour: number, minute = 0) {
  const t = (((hour % 24) + 24) % 24) + minute / 60;
  const arc = ((t - 6) / 12) * Math.PI;
  const elevation = Math.sin(arc);
  const day = Math.min(1, Math.max(0, (elevation + 0.12) / 0.4));
  return { t, arc, day };
}

/** Reads the game clock when available, so the map still renders in isolated tests. */
function useOptionalGameClock(): { hour: number; minute: number } | null {
  const game = useOptionalGameTime();
  if (!game) return null;
  return { hour: game.simulation.gameTime.hour, minute: game.simulation.gameTime.minute };
}

/** Day and night lighting for the 3D town map. Replaces WorldLighting on the map. */
export function MapLighting({ size = 30 }: { size?: number }) {
  const clock = useOptionalGameClock();
  const invalidate = useThree((state) => state.invalidate);
  const hour = clock?.hour ?? 12;
  const minute = clock?.minute ?? 0;
  const { arc, day } = daylightFor(hour, minute);

  const background = useMemo(() => NIGHT_BACKGROUND.clone().lerp(DAY_BACKGROUND, day), [day]);
  const ambientColor = useMemo(() => NIGHT_AMBIENT.clone().lerp(DAY_AMBIENT, day), [day]);
  const sunPosition: [number, number, number] = [
    -Math.cos(arc) * size * 0.9,
    Math.max(Math.sin(arc), 0.2) * size,
    size * 0.4,
  ];

  // The canvas renders on demand, so a clock change must ask for a new frame.
  useEffect(() => {
    invalidate();
  }, [invalidate, hour, minute]);

  return (
    <>
      <color attach="background" args={[background]} />
      <ambientLight color={ambientColor} intensity={0.95 + 0.6 * day} />
      <directionalLight
        position={sunPosition}
        color={ambientColor}
        intensity={0.1 + 1.3 * day}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.001}
        shadow-normalBias={0.04}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-far={size * 3}
      />
      <ContactShadows
        position={[0, 0.015, 0]}
        scale={size * 2}
        opacity={0.28}
        blur={2.5}
        far={8}
        resolution={256}
        frames={Infinity}
        color={WORLD_PALETTE.timber}
      />
    </>
  );
}
