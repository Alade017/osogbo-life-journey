import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import type { Appearance } from "@/game/avatar-appearance";
import type { AvatarEquipment } from "@/components/game/Avatar";
import { shopperLook } from "@/game/mall-appearance";
import type { WorshipLayout } from "@/game/worship-layouts";
import { WorldCharacter } from "./WorldCharacter";
import { WorldLighting, WorldMaterial } from "./WorldScene";
import { useWorshipRowGeometry } from "./worship-row-geometry";

const WALL_HEIGHT = 4;
const WALL_THICKNESS = 0.4;
const DOOR_HALF_WIDTH = 1.1;
const PRAYER_POSE_EPSILON = 0.001;

/** Returns the next pose, snapping exactly to the target when settled. */
export function nextPrayerPose(current: number, target: number, delta: number): number {
  const next = current + (target - current) * Math.min(1, delta * 4);

  return Math.abs(target - next) <= PRAYER_POSE_EPSILON ? target : next;
}

function Wall({
  center,
  size,
  color,
}: {
  center: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={center} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

/** The hall's shell: floor, four walls and a door gap in the south wall. */
function Shell({ layout }: { layout: WorshipLayout }) {
  const { width, depth } = layout.hall;
  const halfW = width / 2;
  const halfD = depth / 2;
  const sideWidth = halfW - DOOR_HALF_WIDTH;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={layout.palette.floor} roughness={0.95} />
      </mesh>
      <Wall
        center={[0, WALL_HEIGHT / 2, -halfD]}
        size={[width, WALL_HEIGHT, WALL_THICKNESS]}
        color={layout.palette.wall}
      />
      <Wall
        center={[-halfW, WALL_HEIGHT / 2, 0]}
        size={[WALL_THICKNESS, WALL_HEIGHT, depth]}
        color={layout.palette.wall}
      />
      <Wall
        center={[halfW, WALL_HEIGHT / 2, 0]}
        size={[WALL_THICKNESS, WALL_HEIGHT, depth]}
        color={layout.palette.wall}
      />
      <Wall
        center={[-(DOOR_HALF_WIDTH + sideWidth / 2), WALL_HEIGHT / 2, halfD]}
        size={[sideWidth, WALL_HEIGHT, WALL_THICKNESS]}
        color={layout.palette.wall}
      />
      <Wall
        center={[DOOR_HALF_WIDTH + sideWidth / 2, WALL_HEIGHT / 2, halfD]}
        size={[sideWidth, WALL_HEIGHT, WALL_THICKNESS]}
        color={layout.palette.wall}
      />
    </group>
  );
}

/** The mihrab niche (mosque) or the altar with a cross (church), on the north wall. */
function Focal({ layout }: { layout: WorshipLayout }) {
  const { focal, palette } = layout;
  if (focal.kind === "mihrab") {
    return (
      <group position={[focal.x, 0, focal.z]}>
        <mesh position={[0, 1.4, 0.2]} castShadow>
          <boxGeometry args={[2.4, 2.8, 0.5]} />
          <meshStandardMaterial color={palette.accent} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.4, 0.48]}>
          <boxGeometry args={[1.4, 2.0, 0.05]} />
          <meshStandardMaterial color={palette.wall} roughness={0.8} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[focal.x, 0, focal.z]}>
      <mesh position={[0, 0.5, 0.2]} castShadow>
        <boxGeometry args={[3.2, 1, 1]} />
        <meshStandardMaterial color={palette.wood} roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.2, -0.3]} castShadow>
        <boxGeometry args={[0.18, 1.6, 0.18]} />
        <meshStandardMaterial color={palette.accent} roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.6, -0.3]} castShadow>
        <boxGeometry args={[0.9, 0.18, 0.18]} />
        <meshStandardMaterial color={palette.accent} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Mats for a mosque, pews for a church, one block per entry in each row. */
function Rows({ layout }: { layout: WorshipLayout }) {
  const isMosque = layout.faith === "mosque";
  // Share one geometry among row meshes in this mounted hall, not across scenes.
  // Each hall owns its geometry and disposes it only after all its rows unmount.
  const geometry = useWorshipRowGeometry(isMosque);
  return (
    <group>
      {layout.rows.flatMap((row) =>
        row.xs.map((x) =>
          isMosque ? (
            <mesh
              key={`mat-${row.z}-${x}`}
              position={[x, 0.03, row.z]}
              receiveShadow
              geometry={geometry}
            >
              <meshStandardMaterial color={layout.palette.carpet} roughness={0.95} />
            </mesh>
          ) : (
            <mesh
              key={`pew-${row.z}-${x}`}
              position={[x, 0.4, row.z]}
              castShadow
              receiveShadow
              geometry={geometry}
            >
              <meshStandardMaterial color={layout.palette.wood} roughness={0.8} />
            </mesh>
          ),
        ),
      )}
    </group>
  );
}

/** The visitor. While praying they settle down and lean forward; the pose eases in and out. */
function Visitor({
  layout,
  praying,
  appearance,
  gender,
  equipment,
}: {
  layout: WorshipLayout;
  praying: boolean;
  appearance: Appearance;
  gender: string;
  equipment: readonly AvatarEquipment[];
}) {
  const { invalidate } = useThree();
  const group = useRef<Group>(null);
  const pose = useRef(0);
  const [px, pz] = layout.prayerSpot;
  const [sx, sz] = layout.spawn;

  useEffect(() => {
    invalidate();
  }, [praying, sx, sz, px, pz, invalidate]);

  useFrame((_, delta) => {
    const target = praying ? 1 : 0;
    if (pose.current === target) return;

    pose.current = nextPrayerPose(pose.current, target, delta);

    const x = sx + (px - sx) * pose.current;
    const z = sz + (pz - sz) * pose.current;
    group.current?.position.set(x, -0.12 * pose.current, z);
    if (group.current) group.current.rotation.x = 0.35 * pose.current;

    invalidate();
  });
  return (
    <group ref={group} position={[sx, 0, sz]}>
      <WorldCharacter
        name="You"
        gender={gender}
        appearance={appearance}
        equipment={equipment}
        facing="north"
        animation="idle"
        position={[0, 0, 0]}
      />
    </group>
  );
}

export function WorshipInterior3D({
  layout,
  praying,
  playerAppearance,
  playerGender,
  playerEquipment,
}: {
  layout: WorshipLayout;
  praying: boolean;
  playerAppearance: Appearance;
  playerGender: string;
  playerEquipment: readonly AvatarEquipment[];
}) {
  return (
    <>
      <WorldLighting size={Math.max(layout.hall.width, layout.hall.depth)} />
      <Shell layout={layout} />
      <Focal layout={layout} />
      <Rows layout={layout} />
      {layout.columns.map(([x, z]) => (
        <mesh key={`column-${x}-${z}`} position={[x, WALL_HEIGHT / 2, z]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, WALL_HEIGHT, 12]} />
          <WorldMaterial tone="wall" color={layout.palette.wall} />
        </mesh>
      ))}
      {layout.congregation.map(([x, z], index) => {
        const look = shopperLook(index + 60);
        return (
          <group key={`worshipper-${index}`} position={[x, 0, z]}>
            <WorldCharacter
              name={`Worshipper ${index + 1}`}
              gender={look.gender}
              appearance={look.appearance}
              facing="north"
              animation="idle"
              position={[0, 0, 0]}
            />
          </group>
        );
      })}
      <Visitor
        layout={layout}
        praying={praying}
        appearance={playerAppearance}
        gender={playerGender}
        equipment={playerEquipment}
      />
    </>
  );
}
