import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { CAMPUS_DESKS, CAMPUS_STUDY_TABLES } from "@/game/campus-navigation";
import { WorldMaterial } from "./WorldScene";
import { CAMPUS_BUILDINGS, CAMPUS_PATHS, type CampusAreaId } from "@/game/school-campus";
function Part({
  at,
  size,
  color = WORLD_PALETTE.wall,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <WorldMaterial tone="wall" color={color} />
    </mesh>
  );
}
function Chair() {
  return (
    <>
      <Part at={[0, 0.48, 0]} size={[0.6, 0.12, 0.55]} color={WORLD_PALETTE.foliage} />
      <Part at={[0, 0.8, 0.25]} size={[0.6, 0.65, 0.1]} color={WORLD_PALETTE.foliage} />
      {[-0.22, 0.22].map((x) => (
        <Part key={x} at={[x, 0.23, 0]} size={[0.06, 0.46, 0.45]} color={WORLD_PALETTE.metal} />
      ))}
    </>
  );
}
function Desk({ width = 1.6 }: { width?: number }) {
  return (
    <>
      <Part at={[0, 0.85, 0]} size={[width, 0.12, 0.85]} color={WORLD_PALETTE.timber} />
      {[-1, 1].map((x) => (
        <Part
          key={x}
          at={[x * (width / 2 - 0.12), 0.4, 0]}
          size={[0.08, 0.8, 0.65]}
          color={WORLD_PALETTE.metal}
        />
      ))}
    </>
  );
}
function Bookshelf() {
  return (
    <>
      <Part at={[0, 1.15, -0.32]} size={[2.2, 2.3, 0.12]} color={WORLD_PALETTE.timber} />
      {[0.2, 0.8, 1.4, 2].map((y) => (
        <group key={y}>
          <Part at={[0, y, 0]} size={[2.2, 0.1, 0.7]} color={WORLD_PALETTE.timber} />
          {Array.from({ length: 6 }, (_, i) => (
            <Part
              key={i}
              at={[-0.85 + i * 0.32, y + 0.25, 0]}
              size={[0.22, 0.4, 0.4]}
              color={[WORLD_PALETTE.slate, WORLD_PALETTE.accent, WORLD_PALETTE.foliage][i % 3]}
            />
          ))}
        </group>
      ))}
    </>
  );
}
function Frontage({ width, depth, color }: { width: number; depth: number; color: string }) {
  return (
    <>
      <Part at={[0, 1.8, 0]} size={[width, 3.6, depth]} color={color} />
      <Part at={[0, 3.7, 0]} size={[width + 0.3, 0.2, depth + 0.3]} color={WORLD_PALETTE.roof} />
      <Part at={[0, 1.15, depth / 2 + 0.02]} size={[1.5, 2.3, 0.06]} color={WORLD_PALETTE.glass} />
      {[-1, 1].map((side) => (
        <Part
          key={side}
          at={[side * width * 0.3, 1.9, depth / 2 + 0.03]}
          size={[width * 0.2, 1.1, 0.07]}
          color={WORLD_PALETTE.glass}
        />
      ))}
      <Part at={[0, 2.9, depth / 2 + 0.5]} size={[width * 0.7, 0.12, 1.3]} color={WORLD_PALETTE.linen} />
    </>
  );
}
export function SchoolCampusScene({
  area,
  onAreaSelect,
  onWalkTo,
}: {
  area: CampusAreaId;
  onAreaSelect?: (id: CampusAreaId) => void;
  onWalkTo?: (point: readonly [number, number]) => void;
}) {
  if (area === "courtyard")
    return (
      <group name="school-campus-grounds">
        {onWalkTo && (
          <mesh
            position={[0, 0.09, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              if (e.delta <= 5) onWalkTo([e.point.x, e.point.z]);
            }}
          >
            <planeGeometry args={[32, 30]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        <Part at={[0, -0.18, 0]} size={[32, 0.3, 30]} color={WORLD_PALETTE.cityLawn} />
        {CAMPUS_PATHS.map((path, i) => (
          <Part
            key={i}
            at={[path.x, 0.01 + i * 0.005, path.z]}
            size={[path.width, 0.06, path.depth]}
            color={WORLD_PALETTE.path}
          />
        ))}
        {[-1, 1].map((side) => (
          <group key={side}>
            <Part at={[side * 3.1, 1.7, 13]} size={[0.3, 3.4, 0.3]} color={WORLD_PALETTE.concrete} />
            <Part at={[side * 10, 0.6, 14]} size={[12, 1.2, 0.2]} color={WORLD_PALETTE.wall} />
            <group position={[side * 12.5, 0, 7]}>
              <mesh position={[0, 1.3, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.22, 2.6, 7]} />
                <WorldMaterial tone="timber" />
              </mesh>
              <mesh position={[0, 3, 0]} castShadow>
                <sphereGeometry args={[1.5, 10, 8]} />
                <WorldMaterial tone="foliage" />
              </mesh>
            </group>
            <Part at={[side * 6, 0.5, 5]} size={[2.5, 0.16, 0.7]} color={WORLD_PALETTE.timber} />
            {[-0.9, 0.9].map((x) => (
              <Part key={x} at={[side * 6 + x, 0.25, 5]} size={[0.15, 0.5, 0.6]} color={WORLD_PALETTE.timber} />
            ))}
          </group>
        ))}
        <Part at={[0, 3.5, 13]} size={[6.5, 0.5, 0.35]} color={WORLD_PALETTE.foliage} />
        {CAMPUS_BUILDINGS.map((building) => (
          <group
            key={building.id}
            position={[building.x, 0, building.z]}
            onClick={(e) => {
              e.stopPropagation();
              if (e.delta <= 5) onAreaSelect?.(building.id);
            }}
          >
            <Frontage width={building.width} depth={building.depth} color={building.color} />
          </group>
        ))}
      </group>
    );
  return (
    <group name={`campus-${area}`}>
      {onWalkTo && (
        <mesh
          position={[0, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            if (e.delta <= 5) onWalkTo([e.point.x, e.point.z]);
          }}
        >
          <planeGeometry args={[12, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <Part
        at={[0, -0.1, 0]}
        size={[12, 0.2, 10]}
        color={area === "library" ? WORLD_PALETTE.timber : WORLD_PALETTE.tileLight}
      />
      <Part at={[0, 1.6, -4.9]} size={[12, 3.2, 0.15]} color={WORLD_PALETTE.wall} />
      <Part at={[-5.9, 0.3, 0]} size={[0.15, 0.6, 10]} />
      <Part at={[5.9, 0.3, 0]} size={[0.15, 0.6, 10]} />
      {area === "classroom" ? (
        <>
          <Part at={[0, 1.9, -4.75]} size={[4.5, 1.6, 0.1]} color={WORLD_PALETTE.partition} />
          <Part at={[0, 1, -4.6]} size={[4.8, 0.1, 0.25]} color={WORLD_PALETTE.timber} />
          <group position={[3.7, 0, -3]}>
            <Desk width={2} />
          </group>
          {CAMPUS_DESKS.map(({ x, z }) => (
            <group key={`${x}:${z}`} position={[x, 0, z]}>
              <Desk />
              <group position={[0, 0, 1]}>
                <Chair />
              </group>
            </group>
          ))}
        </>
      ) : area === "library" ? (
        <>
          {[-3.8, 0, 3.8].map((x) => (
            <group key={x} position={[x, 0, -4.1]}>
              <Bookshelf />
            </group>
          ))}
          {CAMPUS_STUDY_TABLES.map(({ x, z }) => (
            <group key={x} position={[x, 0, z]}>
              <Desk width={2.8} />
              {[-0.8, 0.8].map((xx) => (
                <group key={xx} position={[xx, 0, 1]}>
                  <Chair />
                </group>
              ))}
            </group>
          ))}
        </>
      ) : (
        <>
          <group position={[0, 0, -1]}>
            <Desk width={3.5} />
            <Part at={[1, 1.2, -0.1]} size={[0.6, 0.4, 0.1]} color={WORLD_PALETTE.slate} />
          </group>
          <group position={[-4, 0, -4]}>
            <Bookshelf />
          </group>
          <Part at={[3.7, 1, -4]} size={[2, 2, 0.7]} color={WORLD_PALETTE.concrete} />
          {[-2, 0, 2].map((x) => (
            <group key={x} position={[x, 0, 2.4]}>
              <Chair />
            </group>
          ))}
        </>
      )}
    </group>
  );
}
