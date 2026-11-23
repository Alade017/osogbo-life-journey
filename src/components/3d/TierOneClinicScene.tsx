import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { WorldMaterial } from "./WorldScene";
import { SceneBoxGeometryProvider, useSceneBoxGeometry } from "./scene-box-geometries";
import {
  CLINIC_ROOMS,
  CLINIC_CORRIDORS,
  CLINIC_PARKING,
  type ClinicRoom,
} from "@/game/tier-one-clinic";
import type { VenueFixture } from "@/lib/location-venue-designs";
function Box({
  position,
  size,
  color = WORLD_PALETTE.wall,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string | undefined;
}) {
  const geometry = useSceneBoxGeometry(size);
  return (
    <mesh position={position} castShadow receiveShadow geometry={geometry}>
      <WorldMaterial tone="wall" color={color} />
    </mesh>
  );
}
function Desk() {
  return (
    <>
      <Box position={[0, 0.55, 0]} size={[2.5, 1.1, 0.8]} color={WORLD_PALETTE.foliage} />
      <Box position={[0.6, 1.35, -0.1]} size={[0.65, 0.4, 0.08]} color={WORLD_PALETTE.slate} />
    </>
  );
}
function Seats() {
  return (
    <>
      {[-1, 0, 1].map((x) => (
        <group key={x} position={[x * 0.8, 0, 0]}>
          <Box position={[0, 0.48, 0]} size={[0.65, 0.16, 0.6]} color={WORLD_PALETTE.foliage} />
          <Box position={[0, 0.8, -0.3]} size={[0.65, 0.65, 0.1]} color={WORLD_PALETTE.foliage} />
          <Box position={[0, 0.2, 0]} size={[0.45, 0.4, 0.4]} color={WORLD_PALETTE.metal} />
        </group>
      ))}
    </>
  );
}
function Bed() {
  return (
    <>
      <Box position={[0, 0.45, 0]} size={[1.2, 0.8, 2]} color={WORLD_PALETTE.metal} />
      <Box position={[0, 0.92, 0]} size={[1.4, 0.22, 2.2]} />
      <Box position={[0, 1.08, -0.7]} size={[1, 0.15, 0.5]} color={WORLD_PALETTE.linen} />
    </>
  );
}
function RoomProps({ room }: { room: ClinicRoom }) {
  return (
    <group position={[room.x - 12, 0, room.z - 9]}>
      {room.id === "exam" ? (
        <>
          <group position={[3, 0, 3]}>
            <Bed />
          </group>
          <group position={[1.2, 0, 1]}>
            <Desk />
          </group>
          <Box position={[5.5, 1, 1.3]} size={[0.5, 1.8, 1.3]} color={WORLD_PALETTE.linen} />
        </>
      ) : room.id === "staff" ? (
        <>
          <Box position={[1.2, 1.1, 0.6]} size={[1.9, 2.2, 0.7]} color={WORLD_PALETTE.metal} />
          <Box position={[4.5, 0.6, 0.7]} size={[2, 1.2, 0.8]} color={WORLD_PALETTE.timber} />
          <Box position={[4.5, 1.35, 0.7]} size={[0.4, 0.3, 0.4]} color={WORLD_PALETTE.slate} />
          <group position={[3, 0, 3.5]}>
            <Seats />
          </group>
        </>
      ) : room.id === "restroom" ? (
        <>
          <Box position={[0.8, 0.35, 0.7]} size={[0.6, 0.7, 0.9]} />
          <Box position={[2.3, 0.8, 0.6]} size={[0.65, 0.3, 0.5]} />
        </>
      ) : room.id === "supply" || room.id === "pharmacy" ? (
        <>
          {[0.7, room.width - 0.7].map((x) => (
            <group key={x}>
              <Box position={[x, 1.1, 0.5]} size={[0.8, 2.2, 0.7]} color={WORLD_PALETTE.foliage} />
              {[0.6, 1.2, 1.8].map((y) => (
                <Box
                  key={y}
                  position={[x, y, 0.95]}
                  size={[0.65, 0.3, 0.2]}
                  color={WORLD_PALETTE.linen}
                />
              ))}
            </group>
          ))}
          {room.id === "pharmacy" && (
            <group position={[3, 0, 4]}>
              <Desk />
            </group>
          )}
        </>
      ) : room.id === "reception" ? (
        <>
          <group position={[4, 0, 3]}>
            <Desk />
          </group>
          <Box position={[1.3, 1.1, 6]} size={[0.45, 1.5, 0.4]} color={WORLD_PALETTE.foliage} />
          <Box position={[1.3, 1.95, 6]} size={[0.7, 0.45, 0.15]} color={WORLD_PALETTE.slate} />
        </>
      ) : (
        <>
          {[2.5, 5.5].map((z) => (
            <group key={z} position={[5, 0, z]}>
              <Seats />
            </group>
          ))}
          <Box position={[8.8, 1, 1]} size={[0.8, 2, 0.5]} color={WORLD_PALETTE.foliage} />
        </>
      )}
    </group>
  );
}
function TierOneClinicContents({
  exterior = false,
  selectedRoom = "reception",
  onRoomSelect,
  fixtures,
  selected,
  onSelect,
  onWalkTo,
}: {
  exterior?: boolean;
  selectedRoom?: string;
  onRoomSelect?: (id: string) => void;
  fixtures?: readonly VenueFixture[];
  selected?: string;
  onSelect?: (id: string) => void;
  onWalkTo?: (point: readonly [number, number]) => void;
}) {
  return (
    <group name="tier-one-clinic">
      {!exterior && onWalkTo && (
        <mesh
          position={[0, 0.09, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            if (e.delta <= 5) onWalkTo([e.point.x + 12, e.point.z + 9]);
          }}
        >
          <planeGeometry args={[24, 18]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {exterior && (
        <>
          <Box position={[0, -0.3, 5]} size={[34, 0.4, 44]} color={WORLD_PALETTE.cityLawn} />
          <Box position={[-2, -0.06, 16]} size={[26, 0.12, 18]} color={WORLD_PALETTE.road} />
          {CLINIC_PARKING.map((p, i) => (
            <group key={i} position={[p.x, 0, p.z]}>
              {[-1, 1].map((side) => (
                <Box
                  key={side}
                  position={[(side * p.width) / 2, 0.03, 0]}
                  size={[0.06, 0.03, p.depth]}
                  color={WORLD_PALETTE.roadMarking}
                />
              ))}
              <Box
                position={[0, 0.03, -p.depth / 2]}
                size={[p.width, 0.03, 0.06]}
                color={WORLD_PALETTE.roadMarking}
              />
            </group>
          ))}
          <Box position={[5, 0.08, 15]} size={[3, 0.16, 12]} color={WORLD_PALETTE.path} />
          <Box position={[0, 0.08, 10.5]} size={[10, 0.16, 3]} color={WORLD_PALETTE.path} />
          <Box position={[12, 0.8, -13]} size={[4, 1.6, 3]} color={WORLD_PALETTE.metal} />
          <Box position={[12, 0.1, -13]} size={[5, 0.2, 4]} color={WORLD_PALETTE.concrete} />
          <Box position={[13, 1.2, 22]} size={[3, 2.4, 3]} color={WORLD_PALETTE.wall} />
          <Box position={[3, 1, 24]} size={[10, 0.1, 0.12]} color={WORLD_PALETTE.sign} />
          {[-16, 16].map((x) => (
            <Box
              key={x}
              position={[x, 0.6, 4]}
              size={[0.2, 1.2, 40]}
              color={WORLD_PALETTE.concrete}
            />
          ))}
          <Box position={[0, 0.6, -16]} size={[32, 1.2, 0.2]} color={WORLD_PALETTE.concrete} />
        </>
      )}
      <Box position={[0, -0.1, 0]} size={[24, 0.2, 18]} color={WORLD_PALETTE.tileLight} />
      {CLINIC_CORRIDORS.map((r, i) => (
        <Box
          key={i}
          position={[r.x + r.width / 2 - 12, 0.015, r.z + r.depth / 2 - 9]}
          size={[r.width, 0.03, r.depth]}
          color={WORLD_PALETTE.linen}
        />
      ))}
      <Box position={[0, 0.04, -1]} size={[23, 0.025, 0.1]} color={WORLD_PALETTE.foliage} />
      {CLINIC_ROOMS.map((room) => (
        <group
          key={room.id}
          onClick={(e) => {
            e.stopPropagation();
            if (e.delta <= 5) {
              onRoomSelect?.(room.id);
              if (!exterior) onWalkTo?.([e.point.x + 12, e.point.z + 9]);
            }
          }}
        >
          <Box
            position={[room.x + room.width / 2 - 12, 0.025, room.z + room.depth / 2 - 9]}
            size={[room.width - 0.1, 0.04, room.depth - 0.1]}
            color={room.id === selectedRoom ? WORLD_PALETTE.cityLawn : room.color}
          />
          <Box
            position={[room.x - 12, exterior ? 1.6 : 0.28, room.z + room.depth / 2 - 9]}
            size={[0.12, exterior ? 3.2 : 0.56, room.depth]}
            color={WORLD_PALETTE.wall}
          />
          <Box
            position={[
              room.x + room.width - 12,
              exterior ? 1.6 : 0.28,
              room.z + room.depth / 2 - 9,
            ]}
            size={[0.12, exterior ? 3.2 : 0.56, room.depth]}
            color={WORLD_PALETTE.wall}
          />
          {(
            [
              [room.x, room.doorX - 0.8],
              [room.doorX + 0.8, room.x + room.width],
            ] as [number, number][]
          ).map(([a, b], i) => (
            <Box
              key={i}
              position={[
                (a + b) / 2 - 12,
                exterior ? 1.6 : 0.28,
                (room.z < 6 ? room.z + room.depth : room.z) - 9,
              ]}
              size={[b - a, exterior ? 3.2 : 0.56, 0.12]}
            />
          ))}
          {!exterior && <RoomProps room={room} />}
        </group>
      ))}
      <Box position={[0, 1.6, -9]} size={[24, 3.2, 0.15]} />
      <Box position={[12, exterior ? 1.6 : 0.28, 0]} size={[0.15, exterior ? 3.2 : 0.56, 18]} />
      {exterior ? (
        <>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 6, 3.95, 0]} rotation={[0, 0, side * -0.11]}>
              <Box position={[0, 0, 0]} size={[12.3, 0.18, 18.4]} color={WORLD_PALETTE.roof} />
              {Array.from({ length: 25 }, (_, i) => (
                <Box
                  key={i}
                  position={[-6 + i * 0.5, 0.11, 0]}
                  size={[0.035, 0.04, 18.4]}
                  color={WORLD_PALETTE.roofLight}
                />
              ))}
            </group>
          ))}
          {[-1, 1].map((side) => (
            <group key={side}>
              <Box position={[side * 6.5, 1.6, 9]} size={[11, 3.2, 0.15]} />
              <Box
                position={[side * 0.5, 1.1, 9.05]}
                size={[0.95, 2.2, 0.06]}
                color={WORLD_PALETTE.glass}
              />
              {[3, 7, 10].map((x) => (
                <Box
                  key={x}
                  position={[side * x, 1.7, 9.1]}
                  size={[1.5, 1, 0.06]}
                  color={WORLD_PALETTE.glass}
                />
              ))}
            </group>
          ))}
          <Box position={[0, 2.7, 9.7]} size={[4, 0.16, 2]} color={WORLD_PALETTE.foliage} />
          <mesh position={[0, 0.13, 10.5]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[2, 0.12, 3]} />
            <WorldMaterial tone="concrete" />
          </mesh>
          {[-1.3, 1.3].map((x) => (
            <Box
              key={x}
              position={[x, 0.9, 10.5]}
              size={[0.05, 0.05, 3]}
              color={WORLD_PALETTE.metal}
            />
          ))}
        </>
      ) : (
        fixtures?.map((f) => {
          const p = (f.kind === "counter" ? [-8, 4] : f.kind === "seat" ? [7, 4] : [-9, -6]) as [
            number,
            number,
          ];
          return (
            <group
              key={f.id}
              position={[p[0], 0.12, p[1]]}
              onClick={(e) => {
                e.stopPropagation();
                if (e.delta <= 5) onSelect?.(f.id);
              }}
            >
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.6, 0.75, 24]} />
                <meshBasicMaterial
                  color={selected === f.id ? WORLD_PALETTE.sign : WORLD_PALETTE.foliage}
                />
              </mesh>
            </group>
          );
        })
      )}
    </group>
  );
}

/** Keep resources scoped to this clinic scene, including exterior and room transitions. */
export function TierOneClinicScene(props: Parameters<typeof TierOneClinicContents>[0]) {
  return (
    <SceneBoxGeometryProvider>
      <TierOneClinicContents {...props} />
    </SceneBoxGeometryProvider>
  );
}
