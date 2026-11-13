import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
} from "@react-three/drei";
import { MeshBasicMaterial } from "three";
import type { Appearance } from "@/game/avatar-appearance";
import { WorldCharacter } from "./WorldCharacter";
import { WorldLighting } from "./WorldScene";

/** Worn items may carry their slug so 3D models can be shown on the character. */
export type PreviewEquipment = readonly { slot: string; item?: { slug?: string | null } | null }[];

/** Full-body preview shared by profile and wardrobe. */
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

/** Renders the same rig as a technical wireframe diagnostic in the studio inset. */
function WireframeCharacter({
  appearance,
  gender,
  label,
}: {
  appearance: Appearance;
  gender: string;
  label: string;
}) {
  const { scene } = useThree();
  useEffect(() => {
    const wireframe = new MeshBasicMaterial({
      color: "#9dd7e8",
      wireframe: true,
      transparent: true,
      opacity: 0.88,
    });
    scene.overrideMaterial = wireframe;
    return () => {
      if (scene.overrideMaterial === wireframe) scene.overrideMaterial = null;
      wireframe.dispose();
    };
  }, [scene]);

  return (
    <WorldCharacter
      name={label}
      appearance={appearance}
      gender={gender}
      equipment={[]}
      position={[0, 0, 0]}
    />
  );
}

/** Waist-up studio framing with grid, orbit controls, axis gizmo and wireframe diagnostic. */
export function CharacterStudioPreview({
  appearance,
  gender,
  label,
}: {
  appearance: Appearance;
  gender: string;
  label: string;
}) {
  return (
    <div className="character-studio-canvas" role="img" aria-label={label}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        shadows
        camera={{ position: [0, 1.7, 3.2], fov: 30, near: 0.1, far: 30 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.55, 0)}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <color attach="background" args={["#e8e2d8"]} />
        <WorldLighting size={2.5} />
        <Grid
          position={[0, 0.008, 0]}
          args={[12, 12]}
          cellSize={0.2}
          cellThickness={0.55}
          cellColor="#aaa196"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#766d62"
          fadeDistance={9}
          fadeStrength={1.5}
          infiniteGrid
        />
        <WorldCharacter
          name={label}
          appearance={appearance}
          gender={gender}
          equipment={[]}
          position={[0, 0, 0]}
        />
        <OrbitControls
          makeDefault
          target={[0, 1.55, 0]}
          minDistance={2.7}
          maxDistance={4.6}
          minPolarAngle={0.65}
          maxPolarAngle={1.7}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
        />
        <GizmoHelper alignment="bottom-right" margin={[58, 58]}>
          <GizmoViewport
            axisColors={["#d45a4c", "#4c9b68", "#4c79c8"]}
            labelColor="#28231f"
          />
        </GizmoHelper>
      </Canvas>
      <div className="character-studio-wireframe" aria-hidden="true">
        <span>WIREFRAME</span>
        <Canvas
          dpr={[1, 1.25]}
          frameloop="demand"
          camera={{ position: [0, 1.7, 3.2], fov: 30, near: 0.1, far: 30 }}
          onCreated={({ camera }) => camera.lookAt(0, 1.55, 0)}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        >
          <WireframeCharacter appearance={appearance} gender={gender} label={label} />
        </Canvas>
      </div>
      <div className="character-studio-caption" aria-hidden="true">
        DRAG TO ORBIT · SCROLL TO ZOOM
      </div>
    </div>
  );
}
