import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import type { ZoneNpcSpec } from "@/game/neighborhood-interactions";
import { InteractableZone } from "./InteractableZone";

type PointFn = (x: number, y: number) => [number, number, number];

function ZoneNpcActor({
  npc,
  position,
  isInRange,
  isTargeted,
  onSelect,
  onHoverChange,
}: {
  npc: ZoneNpcSpec;
  position: [number, number, number];
  isInRange: boolean;
  isTargeted: boolean;
  onSelect: (id: string) => void;
  onHoverChange?: (id: string | null) => void;
}) {
  const rightArmRef = useRef<Group>(null);
  const headGroupRef = useRef<Group>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (isInRange || isTargeted) invalidate();
    }, 1000 / 12);
    return () => window.clearInterval(interval);
  }, [invalidate, isInRange, isTargeted]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const arm = rightArmRef.current;
    const head = headGroupRef.current;
    if (arm) {
      arm.rotation.x = isInRange ? -0.45 + Math.sin(t * 5) * 0.28 : Math.sin(t * 2) * 0.08;
    }
    if (head) {
      head.rotation.y = Math.sin(t * 1.4 + npc.position.x * 0.01) * 0.22;
    }
  });

  const shortName = npc.name.split("·")[0]?.trim() ?? npc.name;

  return (
    <InteractableZone
      id={npc.id}
      promptLabel={`Chat · ${shortName}`}
      position={position}
      hitSize={[1.1, 2.2, 1.1]}
      ringRadius={0.68}
      badgeHeight={2.15}
      isInRange={isInRange}
      isTargeted={isTargeted}
      onSelect={onSelect}
      {...(onHoverChange ? { onHoverChange } : {})}
    >
      <group name={`zone-npc-body-${npc.id}`} raycast={() => null}>
        {/* Ground contact shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <circleGeometry args={[0.32, 16]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.22} depthWrite={false} />
        </mesh>

        {/* Torso / uniform shirt */}
        <mesh position={[0, 0.92, 0]} castShadow>
          <capsuleGeometry args={[0.21, 0.46, 4, 8]} />
          <meshStandardMaterial color={npc.shirtColor} roughness={0.75} />
        </mesh>

        {/* Accent collar / badge */}
        <mesh position={[0, 1.16, 0.14]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.12]} />
          <meshStandardMaterial color={npc.accentColor} roughness={0.5} />
        </mesh>

        {/* Head */}
        <group ref={headGroupRef} position={[0, 1.5, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshStandardMaterial color="#8c583a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.1, 10]} />
            <meshStandardMaterial color={npc.accentColor} roughness={0.65} />
          </mesh>
        </group>

        {/* Arms */}
        <mesh position={[-0.27, 0.94, 0]} castShadow>
          <boxGeometry args={[0.11, 0.42, 0.12]} />
          <meshStandardMaterial color="#8c583a" roughness={0.8} />
        </mesh>
        <group ref={rightArmRef} position={[0.27, 1.08, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <boxGeometry args={[0.11, 0.42, 0.12]} />
            <meshStandardMaterial color="#8c583a" roughness={0.8} />
          </mesh>
        </group>

        {/* Legs */}
        {[-0.1, 0.1].map((lx) => (
          <mesh key={lx} position={[lx, 0.34, 0]} castShadow>
            <boxGeometry args={[0.13, 0.44, 0.14]} />
            <meshStandardMaterial color={npc.trouserColor} roughness={0.85} />
          </mesh>
        ))}
      </group>
    </InteractableZone>
  );
}

export function ZoneNpcs({
  npcs,
  point,
  nearbyNpcId,
  targetedId,
  onSelect,
  onHoverChange,
}: {
  npcs: readonly ZoneNpcSpec[];
  point: PointFn;
  nearbyNpcId: string | null;
  targetedId: string | null;
  onSelect: (id: string) => void;
  onHoverChange?: (id: string | null) => void;
}) {
  return (
    <group name="neighborhood-zone-npcs">
      {npcs.map((npc) => (
        <ZoneNpcActor
          key={npc.id}
          npc={npc}
          position={point(npc.position.x, npc.position.y)}
          isInRange={nearbyNpcId === npc.id}
          isTargeted={targetedId === npc.id}
          onSelect={onSelect}
          {...(onHoverChange ? { onHoverChange } : {})}
        />
      ))}
    </group>
  );
}
