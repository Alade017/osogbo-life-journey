import type { WearableEquipment } from "@/game/wearable-outfits";
import { OrbitControls } from "@react-three/drei";
import type { AvatarAnimationState } from "@/components/game/Avatar";
import { Canvas } from "@react-three/fiber";
import type { Appearance } from "@/game/avatar-appearance";
import { WorldCharacter } from "./WorldCharacter";
import { WorldLighting } from "./WorldScene";

/** Worn items may carry their slug so 3D models can be shown on the character. */
export type PreviewEquipment = readonly WearableEquipment[];

/** The same 3D character used in the house, framed for a profile or wardrobe stage. */
/** Full body for the profile stage; "head" frames only the face and hair, for small avatars. */
export function CharacterPreview({
  appearance,
  gender,
  equipment,
  label,
  framing = "body",
  interactive = false,
  animation = "idle",
  rotation = 0,
}: {
  appearance: Appearance;
  gender: string;
  equipment: PreviewEquipment;
  label: string;
  framing?: "body" | "head";
  interactive?: boolean;
  animation?: AvatarAnimationState;
  rotation?: number;
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
        shadows="percentage"
        camera={{ position: camera.position, fov: camera.fov, near: 0.1, far: 30 }}
        onCreated={({ camera: cam }) => cam.lookAt(...camera.target)}
        gl={{ antialias: interactive, powerPreference: "low-power" }}
      >
        <WorldLighting size={3} />
        <group rotation={[0, rotation, 0]}>
          <WorldCharacter
            animation={animation}
            name={label}
            appearance={appearance}
            gender={gender}
            equipment={equipment}
            position={[0, 0, 0]}
          />
        </group>
        {interactive && (
          <OrbitControls
            makeDefault
            enablePan={false}
            enableZoom={false}
            target={camera.target}
            minPolarAngle={1.1}
            maxPolarAngle={1.6}
            rotateSpeed={0.7}
          />
        )}
      </Canvas>
    </div>
  );
}
