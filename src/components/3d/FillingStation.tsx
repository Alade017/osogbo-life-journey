import { useLayoutEffect, useMemo, useRef } from "react";
import { Object3D, type InstancedMesh } from "three";
import type { FillingStationSpec } from "@/game/neighborhood-zones";
import type { WorldPoint } from "@/game/neighborhood-model";
import { stainedConcreteTexture } from "./neighborhood-textures";
import { useInteriorRoofFade } from "./BuildingOcclusion";
import { InteractableZone } from "./InteractableZone";
import { WORLD_PALETTE, WORLD_SCALE } from "./world-theme";

function InstancedJerrycanStacks({
  stacks,
  point,
}: {
  stacks: FillingStationSpec["jerrycanStacks"];
  point: (x: number, y: number) => [number, number, number];
}) {
  const canRef = useRef<InstancedMesh>(null);
  const capRef = useRef<InstancedMesh>(null);

  const offsets = useMemo(
    () =>
      [
        [-0.16, 0.2, -0.1],
        [0.16, 0.2, -0.1],
        [-0.16, 0.2, 0.14],
        [0.16, 0.2, 0.14],
        [0, 0.58, 0.02],
      ] as const,
    [],
  );

  const totalCount = stacks.length * offsets.length;

  useLayoutEffect(() => {
    const canMesh = canRef.current;
    const capMesh = capRef.current;
    if (!canMesh || !capMesh || totalCount === 0) return;

    const dummy = new Object3D();
    let idx = 0;
    for (const stack of stacks) {
      const sp = point(stack.x, stack.y);
      for (const [jx, jy, jz] of offsets) {
        dummy.position.set(sp[0] + jx, jy, sp[2] + jz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        canMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(sp[0] + jx + 0.05, jy + 0.21, sp[2] + jz);
        dummy.updateMatrix();
        capMesh.setMatrixAt(idx, dummy.matrix);
        idx += 1;
      }
    }
    canMesh.instanceMatrix.needsUpdate = true;
    canMesh.computeBoundingSphere();
    capMesh.instanceMatrix.needsUpdate = true;
    capMesh.computeBoundingSphere();
  }, [offsets, point, stacks, totalCount]);

  if (totalCount === 0) return null;

  return (
    <group raycast={() => null}>
      <instancedMesh
        ref={canRef}
        args={[undefined, undefined, totalCount]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[0.24, 0.38, 0.18]} />
        <meshStandardMaterial color="#facc15" roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, totalCount]} raycast={() => null}>
        <cylinderGeometry args={[0.035, 0.035, 0.05, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </instancedMesh>
    </group>
  );
}

function InstancedSafetyBollards({
  bollards,
  point,
}: {
  bollards: FillingStationSpec["bollards"];
  point: (x: number, y: number) => [number, number, number];
}) {
  const postRef = useRef<InstancedMesh>(null);
  const bandRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const postMesh = postRef.current;
    const bandMesh = bandRef.current;
    if (!postMesh || !bandMesh || bollards.length === 0) return;

    const dummy = new Object3D();
    bollards.forEach((bollard, idx) => {
      const bp = point(bollard.x, bollard.y);
      dummy.position.set(bp[0], 0.42, bp[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postMesh.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(bp[0], 0.68, bp[2]);
      dummy.updateMatrix();
      bandMesh.setMatrixAt(idx, dummy.matrix);
    });

    postMesh.instanceMatrix.needsUpdate = true;
    postMesh.computeBoundingSphere();
    bandMesh.instanceMatrix.needsUpdate = true;
    bandMesh.computeBoundingSphere();
  }, [bollards, point]);

  if (bollards.length === 0) return null;

  return (
    <group raycast={() => null}>
      <instancedMesh
        ref={postRef}
        args={[undefined, undefined, bollards.length]}
        castShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.11, 0.13, 0.84, 10]} />
        <meshStandardMaterial color="#d6d3cd" roughness={0.85} />
      </instancedMesh>
      <instancedMesh
        ref={bandRef}
        args={[undefined, undefined, bollards.length]}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.115, 0.115, 0.16, 10]} />
        <meshStandardMaterial color="#eab308" roughness={0.5} />
      </instancedMesh>
    </group>
  );
}

export function FillingStation({
  spec,
  point,
  playerScenePoint,
  nearbyZoneId = null,
  targetedZoneId = null,
  onSelectZone,
  onHoverZone,
}: {
  spec: FillingStationSpec;
  point: (x: number, y: number) => [number, number, number];
  playerScenePoint: WorldPoint | null;
  nearbyZoneId?: string | null;
  targetedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
  onHoverZone?: (zoneId: string | null) => void;
}) {
  const unit = WORLD_SCALE.neighborhoodUnit;
  const concreteMap = useMemo(() => stainedConcreteTexture(), []);

  const playerInsideMart = useMemo(() => {
    if (!playerScenePoint) return false;
    const b = spec.miniMart.interiorBounds;
    return (
      playerScenePoint.x >= b.left - 8 &&
      playerScenePoint.x <= b.right + 4 &&
      playerScenePoint.y >= b.top - 4 &&
      playerScenePoint.y <= b.bottom + 4
    );
  }, [playerScenePoint, spec.miniMart.interiorBounds]);

  // Smoothly fade and hide the mini-mart roof when the player walks inside.
  const roofGroupRef = useInteriorRoofFade(playerInsideMart);

  const forecourtPos = point(spec.forecourt.x, spec.forecourt.y);
  const apronPos = point(spec.apron.x, spec.apron.y);
  const canopyPos = point(spec.canopy.x, spec.canopy.y);
  const martPos = point(spec.miniMart.x, spec.miniMart.y);
  const tankPos = point(spec.waterTank.x, spec.waterTank.y);
  const vulcPos = point(spec.vulcanizer.x, spec.vulcanizer.y);

  const martW = spec.miniMart.width * unit;
  const martD = spec.miniMart.height * unit;
  const wallH = 3.25;
  const wallThick = 10 * unit;
  const doorW = spec.miniMart.doorWidth * unit;
  const westSegmentD = (martD - doorW) / 2;

  return (
    <group name="filling-station">
      {/* 1. Stained concrete forecourt pad (non-raycast blocking so ground tap passes through) */}
      <mesh position={[forecourtPos[0], 0.032, forecourtPos[2]]} receiveShadow raycast={() => null}>
        <boxGeometry args={[spec.forecourt.width * unit, 0.05, spec.forecourt.height * unit]} />
        <meshStandardMaterial map={concreteMap} color="#cbc6bc" roughness={0.94} metalness={0.02} />
      </mesh>

      {/* Flush driveway apron sloping seamlessly from Left Avenue street edge into forecourt */}
      <mesh position={[apronPos[0], 0.034, apronPos[2]]} receiveShadow raycast={() => null}>
        <boxGeometry args={[spec.apron.width * unit, 0.052, spec.apron.height * unit]} />
        <meshStandardMaterial map={concreteMap} color="#c4bfb4" roughness={0.92} />
      </mesh>
      {/* Yellow entry chevrons on the apron */}
      {[-0.3, 0.3].map((factor) => (
        <mesh
          key={`apron-stripe-${factor}`}
          position={[apronPos[0], 0.062, apronPos[2] + factor * spec.apron.height * unit]}
          raycast={() => null}
        >
          <boxGeometry args={[spec.apron.width * unit * 0.85, 0.008, 0.14]} />
          <meshStandardMaterial color="#eab308" roughness={0.7} />
        </mesh>
      ))}

      {/* 2. Fuel Canopy & 4 Structural Columns */}
      <group
        position={[canopyPos[0], 0, canopyPos[2]]}
        userData={{ occluder: true }}
        raycast={() => null}
      >
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`canopy-col-${sx}-${sz}`}
              position={[
                sx * (spec.canopy.width * unit * 0.4),
                2.05,
                sz * (spec.canopy.height * unit * 0.4),
              ]}
              castShadow
            >
              <boxGeometry args={[0.24, 4.1, 0.24]} />
              <meshStandardMaterial color="#d8dee4" roughness={0.5} metalness={0.35} />
            </mesh>
          )),
        )}
        {/* Canopy roof deck */}
        <mesh position={[0, 4.18, 0]} castShadow receiveShadow>
          <boxGeometry args={[spec.canopy.width * unit, 0.34, spec.canopy.height * unit]} />
          <meshStandardMaterial color="#f5f1e8" roughness={0.55} metalness={0.15} />
        </mesh>
        {/* Branded emerald & amber fascia band */}
        <mesh position={[0, 4.2, 0]}>
          <boxGeometry
            args={[spec.canopy.width * unit + 0.06, 0.18, spec.canopy.height * unit + 0.06]}
          />
          <meshStandardMaterial color="#0f766e" roughness={0.45} />
        </mesh>
        <mesh position={[0, 4.06, 0]}>
          <boxGeometry
            args={[spec.canopy.width * unit + 0.07, 0.09, spec.canopy.height * unit + 0.07]}
          />
          <meshStandardMaterial color="#f59e0b" roughness={0.4} />
        </mesh>
        {/* Recessed under-canopy light strips */}
        {[-1, 1].map((sz) => (
          <mesh
            key={`canopy-led-${sz}`}
            position={[0, 3.99, sz * spec.canopy.height * unit * 0.25]}
          >
            <boxGeometry args={[spec.canopy.width * unit * 0.65, 0.04, 0.28]} />
            <meshStandardMaterial color="#fffbeb" emissive="#fde68a" emissiveIntensity={0.45} />
          </mesh>
        ))}
      </group>

      {/* 3. Two Pump Islands with Dual Fuel Dispensers */}
      {spec.pumpIslands.map((island) => {
        const ip = point(island.x, island.y);
        const iw = island.width * unit;
        const id = island.height * unit;
        return (
          <group key={island.id} position={[ip[0], 0, ip[2]]} raycast={() => null}>
            {/* Concrete pump plinth */}
            <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
              <boxGeometry args={[iw, 0.16, id]} />
              <meshStandardMaterial color="#b4afa6" roughness={0.9} />
            </mesh>
            {/* Yellow bumper rail ends */}
            {[-1, 1].map((end) => (
              <mesh key={`bumper-${end}`} position={[end * (iw * 0.46), 0.28, 0]} castShadow>
                <cylinderGeometry args={[0.045, 0.045, 0.38, 8]} />
                <meshStandardMaterial color="#eab308" roughness={0.5} />
              </mesh>
            ))}
            {/* Dual Fuel Dispensers */}
            {[-0.24, 0.24].map((offset) => (
              <group key={`pump-${offset}`} position={[offset * iw, 0.18, 0]}>
                <mesh position={[0, 0.62, 0]} castShadow>
                  <boxGeometry args={[0.56, 1.24, 0.42]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.45} metalness={0.2} />
                </mesh>
                <mesh position={[0, 1.32, 0]}>
                  <boxGeometry args={[0.6, 0.18, 0.44]} />
                  <meshStandardMaterial color="#0f766e" roughness={0.4} />
                </mesh>
                {/* Lit meter screen */}
                <mesh position={[0, 0.88, 0.215]}>
                  <boxGeometry args={[0.38, 0.24, 0.02]} />
                  <meshStandardMaterial
                    color="#ecfdf5"
                    emissive="#a7f3d0"
                    emissiveIntensity={0.3}
                  />
                </mesh>
                <mesh position={[0, 0.88, -0.215]}>
                  <boxGeometry args={[0.38, 0.24, 0.02]} />
                  <meshStandardMaterial
                    color="#ecfdf5"
                    emissive="#a7f3d0"
                    emissiveIntensity={0.3}
                  />
                </mesh>
                {/* Black fuel hose nozzle */}
                <mesh position={[0.31, 0.68, 0]}>
                  <boxGeometry args={[0.06, 0.46, 0.08]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.7} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}

      {/* 4. Walk-In Convenience Mini-Mart (open west doorway + auto-fading roof) */}
      <group position={[martPos[0], 0, martPos[2]]} raycast={() => null}>
        {/* Interior tile floor */}
        <mesh position={[0, 0.055, 0]} receiveShadow>
          <boxGeometry args={[martW - 0.04, 0.04, martD - 0.04]} />
          <meshStandardMaterial color="#ebe5d8" roughness={0.75} />
        </mesh>

        {/* North, South, East solid walls */}
        <mesh position={[0, wallH / 2 + 0.06, -martD / 2 + wallThick / 2]} castShadow receiveShadow>
          <boxGeometry args={[martW, wallH, wallThick]} />
          <meshStandardMaterial color="#f0e8da" roughness={0.88} />
        </mesh>
        <mesh position={[0, wallH / 2 + 0.06, martD / 2 - wallThick / 2]} castShadow receiveShadow>
          <boxGeometry args={[martW, wallH, wallThick]} />
          <meshStandardMaterial color="#f0e8da" roughness={0.88} />
        </mesh>
        <mesh position={[martW / 2 - wallThick / 2, wallH / 2 + 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[wallThick, wallH, martD]} />
          <meshStandardMaterial color="#e6decb" roughness={0.88} />
        </mesh>

        {/* West storefront flanking the open center doorway */}
        {[-1, 1].map((side) => (
          <group
            key={`mart-west-seg-${side}`}
            position={[-martW / 2 + wallThick / 2, 0.06, side * (doorW / 2 + westSegmentD / 2)]}
          >
            {/* Lower masonry knee wall */}
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[wallThick, 1.0, westSegmentD]} />
              <meshStandardMaterial color="#0f766e" roughness={0.8} />
            </mesh>
            {/* Glazed storefront window */}
            <mesh position={[0, 1.85, 0]}>
              <boxGeometry args={[wallThick * 0.45, 1.55, westSegmentD * 0.86]} />
              <meshStandardMaterial
                color="#bae6fd"
                roughness={0.18}
                metalness={0.15}
                transparent
                opacity={0.58}
              />
            </mesh>
            {/* Header lintel */}
            <mesh position={[0, 2.95, 0]} castShadow>
              <boxGeometry args={[wallThick, 0.6, westSegmentD]} />
              <meshStandardMaterial color="#f0e8da" roughness={0.88} />
            </mesh>
          </group>
        ))}

        {/* Doorway transom lintel & welcome mat (doorway remains 100% open!) */}
        <mesh position={[-martW / 2 + wallThick / 2, 2.9, 0]} castShadow>
          <boxGeometry args={[wallThick, 0.72, doorW]} />
          <meshStandardMaterial color="#0f766e" roughness={0.7} />
        </mesh>
        <mesh position={[-martW / 2 + 0.15, 0.08, 0]} receiveShadow>
          <boxGeometry args={[0.7, 0.02, doorW * 0.8]} />
          <meshStandardMaterial color="#334155" roughness={0.95} />
        </mesh>

        {/* Interior: Checkout Counter (north-east corner) */}
        <group position={[0.98, 0.075, -1.88]}>
          <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.78, 0.96, 2.3]} />
            <meshStandardMaterial color={WORLD_PALETTE.timber} roughness={0.75} />
          </mesh>
          <mesh position={[-0.08, 0.98, 0]}>
            <boxGeometry args={[0.88, 0.06, 2.38]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.45} />
          </mesh>
          {/* POS till terminal */}
          <mesh position={[-0.12, 1.14, 0.35]} castShadow>
            <boxGeometry args={[0.26, 0.26, 0.32]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
        </group>

        {/* Interior: Snack Aisle Rack (south-center) */}
        <group position={[-0.08, 0.075, 2.25]}>
          <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.15, 1.24, 0.56]} />
            <meshStandardMaterial color="#64748b" roughness={0.7} />
          </mesh>
          {[-0.35, 0, 0.35].map((sx, idx) => (
            <mesh key={`snack-${idx}`} position={[sx, 1.32, 0]}>
              <boxGeometry args={[0.26, 0.16, 0.36]} />
              <meshStandardMaterial
                color={idx === 0 ? "#ef4444" : idx === 1 ? "#eab308" : "#22c55e"}
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>

        {/* Interior: Drink Chiller Cabinet along east back wall */}
        <group position={[martW / 2 - 0.52, 0.075, 1.6]}>
          <mesh position={[0, 0.95, 0]} castShadow>
            <boxGeometry args={[0.56, 1.9, 1.5]} />
            <meshStandardMaterial color="#0ea5e9" roughness={0.35} />
          </mesh>
          <mesh position={[-0.29, 0.95, 0]}>
            <boxGeometry args={[0.02, 1.55, 1.32]} />
            <meshStandardMaterial
              color="#e0f2fe"
              emissive="#bae6fd"
              emissiveIntensity={0.35}
              roughness={0.2}
            />
          </mesh>
        </group>

        {/* Auto-fading / auto-hiding Mini-Mart Roof & Fascia Sign */}
        <group ref={roofGroupRef} position={[0, wallH + 0.06, 0]}>
          <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
            <boxGeometry args={[martW + 0.35, 0.28, martD + 0.35]} />
            <meshStandardMaterial color="#d8d2c5" roughness={0.85} />
          </mesh>
          <mesh position={[-martW / 2 - 0.18, 0.16, 0]}>
            <boxGeometry args={[0.1, 0.34, martD + 0.36]} />
            <meshStandardMaterial color="#0f766e" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <boxGeometry args={[martW + 0.1, 0.14, martD + 0.1]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.55} />
          </mesh>
        </group>
      </group>

      {/* 5. Overhead Black Water Tank on Metal Truss Frame */}
      <group position={[tankPos[0], 0, tankPos[2]]} raycast={() => null}>
        {[-0.45, 0.45].flatMap((lx) =>
          [-0.45, 0.45].map((lz) => (
            <mesh key={`tank-leg-${lx}-${lz}`} position={[lx, 1.5, lz]} castShadow>
              <boxGeometry args={[0.09, 3.0, 0.09]} />
              <meshStandardMaterial color="#334155" roughness={0.55} metalness={0.5} />
            </mesh>
          )),
        )}
        {/* Horizontal brace rings */}
        {[1.1, 2.1, 3.0].map((hy) => (
          <mesh key={`tank-brace-${hy}`} position={[0, hy, 0]} castShadow>
            <boxGeometry args={[1.05, 0.08, 1.05]} />
            <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.5} />
          </mesh>
        ))}
        {/* Black GeePee Cylinder Water Tank */}
        <mesh position={[0, 3.68, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.62, 1.25, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.38} metalness={0.12} />
        </mesh>
        <mesh position={[0, 4.35, 0]}>
          <cylinderGeometry args={[0.65, 0.65, 0.1, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </mesh>
      </group>

      {/* 6. Location-Specific Surroundings: Vulcanizer Corner with Umbrella */}
      <group position={[vulcPos[0], 0, vulcPos[2]]} raycast={() => null}>
        {/* Umbrella pole & canopy */}
        <mesh position={[0, 1.18, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 2.36, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
        <mesh position={[0, 2.32, 0]} castShadow>
          <coneGeometry args={[1.25, 0.48, 8]} />
          <meshStandardMaterial color="#dc2626" roughness={0.75} />
        </mesh>
        {/* Air compressor cylinder */}
        <mesh position={[-0.45, 0.36, 0.25]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.72, 12]} />
          <meshStandardMaterial color="#15803d" roughness={0.45} metalness={0.35} />
        </mesh>
        {/* Stacked spare rubber tires */}
        {[0, 0.18, 0.36].map((ty, idx) => (
          <mesh
            key={`tire-${idx}`}
            position={[0.45, 0.11 + ty, -0.22]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.24, 0.09, 8, 16]} />
            <meshStandardMaterial color="#18181b" roughness={0.92} />
          </mesh>
        ))}
        {/* Leaning tire */}
        <mesh position={[0.15, 0.32, 0.42]} rotation={[0.35, 0.4, 0]} castShadow>
          <torusGeometry args={[0.26, 0.09, 8, 16]} />
          <meshStandardMaterial color="#18181b" roughness={0.92} />
        </mesh>
      </group>

      {/* 7. Instanced Stacked Yellow Jerrycans & Safety Bollards */}
      <InstancedJerrycanStacks stacks={spec.jerrycanStacks} point={point} />
      <InstancedSafetyBollards bollards={spec.bollards} point={point} />

      {/* 9. Interactive Zone Markers: Fuel Pumps, Mini-Mart Counter, Vulcanizer */}
      {onSelectZone && (
        <>
          <InteractableZone
            id="zone-fuel-pumps"
            promptLabel="Fuel Pumps"
            position={point(668, 250)}
            hitSize={[2.1, 2.2, 3.6]}
            ringRadius={1.08}
            badgeHeight={2.3}
            isInRange={nearbyZoneId === "zone-fuel-pumps"}
            isTargeted={targetedZoneId === "zone-fuel-pumps"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-mini-mart"
            promptLabel="Enter Mart"
            position={point(820, 230)}
            hitSize={[2.4, 2.8, 3.5]}
            ringRadius={0.96}
            badgeHeight={2.45}
            isInRange={nearbyZoneId === "zone-mini-mart"}
            isTargeted={targetedZoneId === "zone-mini-mart"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-vulcanizer"
            promptLabel="Vulcanizer"
            position={point(spec.vulcanizer.x, spec.vulcanizer.y)}
            hitSize={[1.8, 2.2, 1.8]}
            ringRadius={0.95}
            badgeHeight={2.45}
            isInRange={nearbyZoneId === "zone-vulcanizer"}
            isTargeted={targetedZoneId === "zone-vulcanizer"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
        </>
      )}
    </group>
  );
}
