import { NpcBody } from "@/components/3d/NpcBody";
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

  const active = isInRange || isTargeted;
  useEffect(() => {
    invalidate();
  }, [invalidate, active]);

  useFrame((state) => {
    const t = active ? state.clock.elapsedTime : 0;
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
        <NpcBody detail="zone" shirtColor={npc.shirtColor} accentColor={npc.accentColor} trouserColor={npc.trouserColor} rightArmRef={rightArmRef} headGroupRef={headGroupRef} />
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
  const { invalidate } = useThree();
  const active = npcs.some((npc) => npc.id === nearbyNpcId || npc.id === targetedId);
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(invalidate, 1000 / 12);
    return () => window.clearInterval(interval);
  }, [active, invalidate]);
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
