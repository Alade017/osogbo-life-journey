import { Canvas } from "@react-three/fiber";
import type { Appearance } from "@/game/avatar-appearance";
import { WorldCharacter } from "./WorldCharacter";
import { WorldLighting } from "./WorldScene";

/** Worn items may carry their slug so 3D models can be shown on the character. */
export type PreviewEquipment = readonly { slot: string; item?: { slug?: string | null } | null }[];

/** The same 3D character used in the house, framed for a profile or wardrobe stage. */
/** Full body for the profile stage; "head" frames only the face and hair, for small avatars. */
export function CharacterPreview({
  appearance,
  gender,
  equipment,
  label,
  framing = "body",
}: {
  appearance: Appearance;
  gender: string;
  equipment: PreviewEquipment;
  label: string;
  framing?: "body" | "head";
}) {
  const head = framing === "head";
  const camera: {
    position: [number, number, number];
    fov: number;
    target: [number, number, number];
  } = head
    ? { position: [0, 1.5, 1.05], fov: 24, target: [0, 1.46, 0] }
    : { position: [0, 1.2, 3.9], fov: 28, target: [0, 0.9, 0] };
  return (
    <div className={head ? "pi-canvas pi-canvas-head" : "pi-canvas"} role="img" aria-label={label}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        shadows
        camera={{ position: camera.position, fov: camera.fov, near: 0.1, far: 30 }}
        onCreated={({ camera: cam }) => cam.lookAt(...camera.target)}
        gl={{ antialias: false, powerPreference: "low-power" }}
      >
        <WorldLighting size={3} />
        <WorldCharacter
          name={label}
          appearance={appearance}
          gender={gender}
          equipment={equipment}
          position={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
