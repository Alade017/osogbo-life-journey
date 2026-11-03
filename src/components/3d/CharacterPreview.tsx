import { Canvas } from "@react-three/fiber";
import type { Appearance } from "@/game/avatar-appearance";
import { WorldCharacter } from "./WorldCharacter";
import { WorldLighting } from "./WorldScene";

/** Worn items may carry their slug so 3D models can be shown on the character. */
export type PreviewEquipment = readonly { slot: string; item?: { slug?: string | null } | null }[];

/** The same 3D character used in the house, framed for a profile or wardrobe stage. */
export function CharacterPreview({
  appearance,
  gender,
  equipment,
  label,
}: {
  appearance: Appearance;
  gender: string;
  equipment: PreviewEquipment;
  label: string;
}) {
  return (
    <div className="pi-canvas" role="img" aria-label={label}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        shadows
        camera={{ position: [0, 1.2, 3.9], fov: 28, near: 0.1, far: 30 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}
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
