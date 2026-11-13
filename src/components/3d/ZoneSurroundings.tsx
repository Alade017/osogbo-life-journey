import { useLayoutEffect, useMemo, useRef } from "react";
import { Object3D, type InstancedMesh } from "three";
import type {
  AdireMarketSpec,
  CommercialBankSpec,
  CommercialShopsSpec,
  NeighborhoodZoneLayout,
} from "@/game/neighborhood-zones";
import type { WorldPoint } from "@/game/neighborhood-model";
import {
  adireIndigoClothTexture,
  asphaltShoulderTexture,
  interlockingPavingTexture,
  lateriteGroundTexture,
} from "./neighborhood-textures";
import { useInteriorRoofFade } from "./BuildingOcclusion";
import { InteractableZone } from "./InteractableZone";
import { WORLD_PALETTE, WORLD_SCALE } from "./world-theme";

type PointFn = (x: number, y: number) => [number, number, number];

type InteractiveProps = {
  playerScenePoint: WorldPoint | null;
  nearbyZoneId?: string | null;
  targetedZoneId?: string | null;
  onSelectZone?: (zoneId: string) => void;
  onHoverZone?: (zoneId: string | null) => void;
};

function InstancedBankStanchions({
  stanchions,
  point,
}: {
  stanchions: CommercialBankSpec["stanchions"];
  point: PointFn;
}) {
  const baseRef = useRef<InstancedMesh>(null);
  const postRef = useRef<InstancedMesh>(null);
  const beltRef = useRef<InstancedMesh>(null);
  const beltCount = Math.max(0, stanchions.length - 1);

  useLayoutEffect(() => {
    const baseMesh = baseRef.current;
    const postMesh = postRef.current;
    const beltMesh = beltRef.current;
    if (!baseMesh || !postMesh || stanchions.length === 0) return;

    const dummy = new Object3D();
    stanchions.forEach((stanchion, idx) => {
      const sp = point(stanchion.x, stanchion.y);
      dummy.position.set(sp[0], 0.085, sp[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      baseMesh.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(sp[0], 0.535, sp[2]);
      dummy.updateMatrix();
      postMesh.setMatrixAt(idx, dummy.matrix);

      if (beltMesh && idx < beltCount) {
        const next = stanchions[idx + 1]!;
        const np = point(next.x, next.y);
        const dx = np[0] - sp[0];
        const dz = np[2] - sp[2];
        const length = Math.hypot(dx, dz);
        dummy.position.set((sp[0] + np[0]) / 2, 0.88, (sp[2] + np[2]) / 2);
        dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        dummy.scale.set(1, 1, length);
        dummy.updateMatrix();
        beltMesh.setMatrixAt(idx, dummy.matrix);
      }
    });

    baseMesh.instanceMatrix.needsUpdate = true;
    baseMesh.computeBoundingSphere();
    postMesh.instanceMatrix.needsUpdate = true;
    postMesh.computeBoundingSphere();
    if (beltMesh && beltCount > 0) {
      beltMesh.instanceMatrix.needsUpdate = true;
      beltMesh.computeBoundingSphere();
    }
  }, [beltCount, point, stanchions]);

  if (stanchions.length === 0) return null;

  return (
    <group raycast={() => null}>
      <instancedMesh
        ref={baseRef}
        args={[undefined, undefined, stanchions.length]}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.14, 0.16, 0.06, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </instancedMesh>
      <instancedMesh
        ref={postRef}
        args={[undefined, undefined, stanchions.length]}
        castShadow
        raycast={() => null}
      >
        <cylinderGeometry args={[0.028, 0.028, 0.9, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.75} roughness={0.25} />
      </instancedMesh>
      {beltCount > 0 && (
        <instancedMesh ref={beltRef} args={[undefined, undefined, beltCount]} raycast={() => null}>
          <boxGeometry args={[0.03, 0.07, 1]} />
          <meshStandardMaterial color="#0f2b5b" roughness={0.7} />
        </instancedMesh>
      )}
    </group>
  );
}

function InstancedMarketCrates({
  crates,
  point,
}: {
  crates: AdireMarketSpec["crates"];
  point: PointFn;
}) {
  const mainRef = useRef<InstancedMesh>(null);
  const sideRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mainMesh = mainRef.current;
    const sideMesh = sideRef.current;
    if (!mainMesh || !sideMesh || crates.length === 0) return;

    const dummy = new Object3D();
    crates.forEach((crate, idx) => {
      const cp = point(crate.x, crate.y);
      dummy.position.set(cp[0], 0.28, cp[2]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mainMesh.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(cp[0] + 0.46, 0.22, cp[2] + 0.12);
      dummy.rotation.set(0, 0.25, 0);
      dummy.updateMatrix();
      sideMesh.setMatrixAt(idx, dummy.matrix);
    });

    mainMesh.instanceMatrix.needsUpdate = true;
    mainMesh.computeBoundingSphere();
    sideMesh.instanceMatrix.needsUpdate = true;
    sideMesh.computeBoundingSphere();
  }, [crates, point]);

  if (crates.length === 0) return null;

  return (
    <group raycast={() => null}>
      <instancedMesh
        ref={mainRef}
        args={[undefined, undefined, crates.length]}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[0.52, 0.48, 0.52]} />
        <meshStandardMaterial color="#b48352" roughness={0.88} />
      </instancedMesh>
      <instancedMesh
        ref={sideRef}
        args={[undefined, undefined, crates.length]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[0.4, 0.36, 0.4]} />
        <meshStandardMaterial color="#9c6c3f" roughness={0.88} />
      </instancedMesh>
    </group>
  );
}

function ServiceAlley({
  alley,
  point,
}: {
  alley: NeighborhoodZoneLayout["serviceAlley"];
  point: PointFn;
}) {
  const unit = WORLD_SCALE.neighborhoodUnit;
  const pos = point(alley.x, alley.y);
  const w = alley.width * unit;
  const d = alley.height * unit;

  return (
    <group name="service-alley" position={[pos[0], 0, pos[2]]} raycast={() => null}>
      {/* Compacted dark asphalt/concrete service lane separating Filling Station and Bank */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[w, 0.045, d]} />
        <meshStandardMaterial color="#707479" roughness={0.93} />
      </mesh>
      {/* Subtle raised side kerbs */}
      {[-1, 1].map((side) => (
        <mesh key={`alley-kerb-${side}`} position={[side * (w / 2 - 0.06), 0.06, 0]} receiveShadow>
          <boxGeometry args={[0.12, 0.06, d]} />
          <meshStandardMaterial color="#b4b0a6" roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

function CommercialBank({
  spec,
  point,
  playerScenePoint,
  nearbyZoneId = null,
  targetedZoneId = null,
  onSelectZone,
  onHoverZone,
}: {
  spec: CommercialBankSpec;
  point: PointFn;
} & InteractiveProps) {
  const unit = WORLD_SCALE.neighborhoodUnit;
  const pavingMap = useMemo(() => interlockingPavingTexture(), []);

  const insideLobby = useMemo(() => {
    if (!playerScenePoint) return false;
    const b = spec.lobbyBounds;
    return (
      playerScenePoint.x >= b.left - 4 &&
      playerScenePoint.x <= b.right + 10 &&
      playerScenePoint.y >= b.top - 4 &&
      playerScenePoint.y <= b.bottom + 4
    );
  }, [playerScenePoint, spec.lobbyBounds]);

  const upperStoryRef = useInteriorRoofFade(insideLobby);

  const courtyardPos = point(spec.courtyard.x, spec.courtyard.y);
  const buildingPos = point(spec.building.x, spec.building.y);
  const alcovePos = point(spec.atmAlcove.x, spec.atmAlcove.y);
  const lotPos = point(spec.parkingLot.x, spec.parkingLot.y);
  const postPos = point(spec.securityPost.x, spec.securityPost.y);

  const bw = spec.building.width * unit;
  const bd = spec.building.height * unit;
  const wallThick = 10 * unit;
  const wallH = 3.1;
  const upperH = 2.3;
  const doorW = spec.lobbyDoorWidth * unit;
  const doorLocalZ = (spec.lobbyDoorCenterY - spec.building.y) * unit;
  const northEastSegD = bd / 2 + doorLocalZ - doorW / 2;
  const southEastSegD = bd / 2 - doorLocalZ - doorW / 2;

  // Parking lot perimeter fence geometry matching exact colliders in neighborhood-zones.ts
  const fenceNorthPos = point(1222, 248);
  const fenceSouthPos = point(1222, 410);
  const fenceBottomPos = point(1080, 438);
  const gateNorthPostPos = point(1222, 284);
  const gateSouthPostPos = point(1222, 380);

  return (
    <group name="commercial-bank" raycast={() => null}>
      {/* 1. Interlocking gray paving courtyard */}
      <mesh position={[courtyardPos[0], 0.032, courtyardPos[2]]} receiveShadow>
        <boxGeometry args={[spec.courtyard.width * unit, 0.05, spec.courtyard.height * unit]} />
        <meshStandardMaterial map={pavingMap} color="#c5ccd4" roughness={0.88} />
      </mesh>

      {/* Painted parking bay lines inside gated lot */}
      <group position={[lotPos[0], 0.06, lotPos[2]]}>
        {[-1.55, -0.35, 0.85, 2.05].map((dz, idx) => (
          <mesh key={`bay-line-${idx}`} position={[-1.4, 0, dz]}>
            <boxGeometry args={[2.3, 0.008, 0.07]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.65} />
          </mesh>
        ))}
        <mesh position={[0.45, 0, 1.35]}>
          <boxGeometry args={[2.3, 0.008, 0.07]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.65} />
        </mesh>
      </group>

      {/* 2. Walk-In 2-Story Modern Bank Facing Right Avenue (+X) */}
      <group position={[buildingPos[0], 0, buildingPos[2]]} userData={{ occluder: true }}>
        {/* Granite lobby floor */}
        <mesh position={[0, 0.07, 0]} receiveShadow>
          <boxGeometry args={[bw - 0.04, 0.06, bd - 0.04]} />
          <meshStandardMaterial color="#e7eef5" roughness={0.55} />
        </mesh>

        {/* Ground-floor Perimeter Walls (open east lobby doorway at doorLocalZ) */}
        <mesh position={[0, wallH / 2 + 0.08, -bd / 2 + wallThick / 2]} castShadow receiveShadow>
          <boxGeometry args={[bw, wallH, wallThick]} />
          <meshStandardMaterial color="#eef2f6" roughness={0.8} />
        </mesh>
        <mesh position={[0, wallH / 2 + 0.08, bd / 2 - wallThick / 2]} castShadow receiveShadow>
          <boxGeometry args={[bw, wallH, wallThick]} />
          <meshStandardMaterial color="#eef2f6" roughness={0.8} />
        </mesh>
        <mesh position={[-bw / 2 + wallThick / 2, wallH / 2 + 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[wallThick, wallH, bd]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.82} />
        </mesh>

        {/* East wall north & south glazed curtain segments around open lobby doorway */}
        <mesh
          position={[bw / 2 - wallThick / 2, wallH / 2 + 0.08, -bd / 2 + northEastSegD / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThick, wallH, northEastSegD]} />
          <meshStandardMaterial color="#eef2f6" roughness={0.8} />
        </mesh>
        <mesh
          position={[bw / 2 - wallThick / 2, wallH / 2 + 0.08, bd / 2 - southEastSegD / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThick, wallH, southEastSegD]} />
          <meshStandardMaterial color="#eef2f6" roughness={0.8} />
        </mesh>
        {/* East ground-floor curtain glass window on south span */}
        <mesh position={[bw / 2 + 0.02, 1.55, bd / 2 - southEastSegD * 0.5]}>
          <boxGeometry args={[0.05, 1.45, Math.max(0.6, southEastSegD * 0.65)]} />
          <meshStandardMaterial color="#1e4d7b" roughness={0.18} metalness={0.55} />
        </mesh>

        {/* Doorway transom lintel + open floor entry strip + cantilevered portico */}
        <mesh position={[bw / 2 - wallThick / 2, 2.75, doorLocalZ]} castShadow>
          <boxGeometry args={[wallThick, 0.72, doorW]} />
          <meshStandardMaterial color="#0f2b5b" roughness={0.55} />
        </mesh>
        <mesh position={[bw / 2 + 0.25, 0.085, doorLocalZ]} receiveShadow>
          <boxGeometry args={[0.9, 0.03, doorW]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.85} />
        </mesh>
        <mesh position={[bw / 2 + 0.65, 2.55, doorLocalZ]} castShadow>
          <boxGeometry args={[1.35, 0.22, doorW + 0.5]} />
          <meshStandardMaterial color="#0f2b5b" roughness={0.5} />
        </mesh>
        {/* Propped-open glass double doors folded gently to door jambs */}
        {[-1, 1].map((side) => (
          <mesh
            key={`bank-open-door-${side}`}
            position={[bw / 2 + 0.24, 1.25, doorLocalZ + side * (doorW / 2 - 0.08)]}
          >
            <boxGeometry args={[0.52, 2.05, 0.05]} />
            <meshStandardMaterial
              color="#38bdf8"
              roughness={0.15}
              metalness={0.35}
              transparent
              opacity={0.72}
            />
          </mesh>
        ))}

        {/* Interior: Teller Counter Desk & Protective Glass Partition */}
        <group position={[-bw / 2 + 1.45, 0.08, -0.25]}>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 1.0, 2.9]} />
            <meshStandardMaterial color="#0f2b5b" roughness={0.55} />
          </mesh>
          <mesh position={[0.04, 1.03, 0]}>
            <boxGeometry args={[0.8, 0.07, 3.0]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
          <mesh position={[0.28, 1.42, 0]}>
            <boxGeometry args={[0.04, 0.7, 2.7]} />
            <meshStandardMaterial color="#bae6fd" transparent opacity={0.48} roughness={0.15} />
          </mesh>
          {[-0.85, 0.85].map((tz, idx) => (
            <mesh key={`teller-screen-${idx}`} position={[-0.1, 1.22, tz]} castShadow>
              <boxGeometry args={[0.24, 0.3, 0.36]} />
              <meshStandardMaterial color="#1e293b" roughness={0.45} />
            </mesh>
          ))}
        </group>

        {/* Interior: Customer Waiting Bench */}
        <group position={[0.26, 0.08, 1.98]}>
          <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.45, 0.42, 0.52]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.65} />
          </mesh>
        </group>

        {/* Architectural vertical sun-breaker fins on ground facade */}
        {[-bd * 0.42, bd * 0.42].map((fz, idx) => (
          <mesh key={`fin-${idx}`} position={[bw / 2 + 0.11, 1.6, fz]} castShadow>
            <boxGeometry args={[0.22, wallH, 0.1]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.65} />
          </mesh>
        ))}

        {/* Second Story & Rooftop Parapet (auto-fades when player walks into lobby) */}
        <group ref={upperStoryRef} position={[0, wallH + 0.08, 0]}>
          <mesh position={[0, upperH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[bw, upperH, bd]} />
            <meshStandardMaterial color="#eef2f6" roughness={0.8} />
          </mesh>
          {/* Corporate deep-navy & bronze accent fascia */}
          <mesh position={[bw / 2 - 0.06, upperH - 0.38, 0]}>
            <boxGeometry args={[0.18, 0.72, bd + 0.08]} />
            <meshStandardMaterial color="#0f2b5b" roughness={0.45} metalness={0.2} />
          </mesh>
          <mesh position={[bw / 2 - 0.04, upperH - 0.8, 0]}>
            <boxGeometry args={[0.18, 0.12, bd + 0.08]} />
            <meshStandardMaterial color="#d97706" roughness={0.35} metalness={0.35} />
          </mesh>
          {[-bd * 0.28, 0, bd * 0.28].map((wz, wIdx) => (
            <mesh key={`east-win-top-${wIdx}`} position={[bw / 2 + 0.02, 0.95, wz]}>
              <boxGeometry args={[0.05, 1.15, 1.15]} />
              <meshStandardMaterial color="#1e4d7b" roughness={0.18} metalness={0.55} />
            </mesh>
          ))}
          <mesh position={[0, upperH + 0.18, 0]} castShadow>
            <boxGeometry args={[bw + 0.1, 0.36, bd + 0.1]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
          </mesh>
          <mesh position={[-0.7, upperH + 0.62, -0.8]} castShadow>
            <boxGeometry args={[1.35, 0.55, 1.2]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      </group>

      {/* 3. Accessible Exterior ATM Alcove */}
      <group position={[alcovePos[0], 0, alcovePos[2]]}>
        <mesh position={[0, 0.075, 0]} receiveShadow>
          <boxGeometry args={[spec.atmAlcove.width * unit, 0.05, spec.atmAlcove.height * unit]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.48, 0]} castShadow>
          <boxGeometry
            args={[spec.atmAlcove.width * unit + 0.2, 0.16, spec.atmAlcove.height * unit + 0.2]}
          />
          <meshStandardMaterial color="#0f2b5b" roughness={0.45} />
        </mesh>
        <mesh position={[spec.atmAlcove.width * unit * 0.5 + 0.11, 2.48, 0]}>
          <boxGeometry args={[0.06, 0.1, spec.atmAlcove.height * unit + 0.22]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.45} />
        </mesh>
        {[-0.65, 0, 0.65].map((az, idx) => (
          <group key={`atm-unit-${idx}`} position={[-0.36, 0.1, az]}>
            <mesh position={[0, 0.72, 0]} castShadow>
              <boxGeometry args={[0.42, 1.44, 0.44]} />
              <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.3} />
            </mesh>
            <mesh position={[0.22, 0.92, 0]}>
              <boxGeometry args={[0.02, 0.34, 0.3]} />
              <meshStandardMaterial
                color="#bae6fd"
                emissive={idx === 1 ? "#22c55e" : "#38bdf8"}
                emissiveIntensity={0.55}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* 4. Instanced ATM Queue Stanchions */}
      <InstancedBankStanchions stanchions={spec.stanchions} point={point} />

      {/* 5. Potted Palms */}
      {spec.pottedPalms.map((palm, idx) => {
        const pp = point(palm.x, palm.y);
        return (
          <group key={`bank-palm-${idx}`} position={[pp[0], 0.055, pp[2]]}>
            <mesh position={[0, 0.28, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.18, 0.56, 10]} />
              <meshStandardMaterial color="#b45309" roughness={0.88} />
            </mesh>
            <mesh position={[0, 0.72, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 0.55, 8]} />
              <meshStandardMaterial color="#78563a" roughness={0.9} />
            </mesh>
            {[0, 1, 2, 3, 4].map((f) => {
              const angle = (f * Math.PI * 2) / 5 + idx * 0.4;
              return (
                <mesh
                  key={`frond-${f}`}
                  position={[Math.cos(angle) * 0.34, 1.05, Math.sin(angle) * 0.34]}
                  rotation={[0, -angle, -0.35]}
                  castShadow
                >
                  <boxGeometry args={[0.72, 0.05, 0.2]} />
                  <meshStandardMaterial color="#4d7c4a" roughness={0.85} />
                </mesh>
              );
            })}
          </group>
        );
      })}

      {/* 6. Gated Parking Lot Perimeter Fence & Open Gate Posts */}
      {[
        { pos: fenceNorthPos, w: 10 * unit, d: 72 * unit },
        { pos: fenceSouthPos, w: 10 * unit, d: 60 * unit },
        { pos: fenceBottomPos, w: 280 * unit, d: 10 * unit },
      ].map((seg, idx) => (
        <group key={`bank-fence-${idx}`} position={[seg.pos[0], 0, seg.pos[2]]}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[seg.w, 0.9, seg.d]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.88} />
          </mesh>
          <mesh position={[0, 1.25, 0]} castShadow>
            <boxGeometry args={[seg.w * 0.6, 0.72, seg.d * 0.6]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.55} />
          </mesh>
        </group>
      ))}
      {[gateNorthPostPos, gateSouthPostPos].map((gp, idx) => (
        <mesh key={`gate-pillar-${idx}`} position={[gp[0], 0.9, gp[2]]} castShadow>
          <boxGeometry args={[0.42, 1.8, 0.42]} />
          <meshStandardMaterial color="#0f2b5b" roughness={0.65} />
        </mesh>
      ))}

      {/* 7. Security Post */}
      <group position={[postPos[0], 0, postPos[2]]}>
        <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[spec.securityPost.width * unit, 2.3, spec.securityPost.height * unit]}
          />
          <meshStandardMaterial color="#e2e8f0" roughness={0.82} />
        </mesh>
        <mesh position={[0, 1.35, 0]}>
          <boxGeometry
            args={[
              spec.securityPost.width * unit + 0.04,
              0.78,
              spec.securityPost.height * unit + 0.04,
            ]}
          />
          <meshStandardMaterial color="#1e3a8a" roughness={0.25} metalness={0.35} />
        </mesh>
        <mesh position={[0, 2.42, 0]} castShadow>
          <boxGeometry
            args={[
              spec.securityPost.width * unit + 0.35,
              0.22,
              spec.securityPost.height * unit + 0.35,
            ]}
          />
          <meshStandardMaterial color="#0f2b5b" roughness={0.55} />
        </mesh>
      </group>

      {/* 8. Parked Customer & Staff Sedans */}
      {spec.parkedSedans.map((sedan, idx) => {
        const sp = point(sedan.x, sedan.y);
        return (
          <group
            key={`bank-sedan-${idx}`}
            position={[sp[0], 0.055, sp[2]]}
            rotation={[0, sedan.rotation, 0]}
          >
            <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.65, 0.42, 0.82]} />
              <meshStandardMaterial color={sedan.color} roughness={0.45} metalness={0.25} />
            </mesh>
            <mesh position={[-0.08, 0.64, 0]} castShadow>
              <boxGeometry args={[0.92, 0.34, 0.72]} />
              <meshStandardMaterial color={sedan.color} roughness={0.45} metalness={0.2} />
            </mesh>
            <mesh position={[-0.08, 0.66, 0]}>
              <boxGeometry args={[0.84, 0.24, 0.74]} />
              <meshStandardMaterial color="#334155" roughness={0.2} metalness={0.4} />
            </mesh>
            {[-0.52, 0.52].flatMap((wx) =>
              [-0.4, 0.4].map((wz) => (
                <mesh
                  key={`wheel-${wx}-${wz}`}
                  position={[wx, 0.14, wz]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.14, 0.14, 0.1, 10]} />
                  <meshStandardMaterial color="#18181b" roughness={0.9} />
                </mesh>
              )),
            )}
          </group>
        );
      })}

      {/* 9. Bank Interactables: Exterior ATM & Walk-In Lobby */}
      {onSelectZone && (
        <>
          <InteractableZone
            id="zone-bank-atm"
            promptLabel="Use ATM"
            position={alcovePos}
            hitSize={[1.5, 2.6, 2.2]}
            ringRadius={0.95}
            badgeHeight={2.55}
            isInRange={nearbyZoneId === "zone-bank-atm"}
            isTargeted={targetedZoneId === "zone-bank-atm"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-bank-lobby"
            promptLabel="Bank Lobby"
            position={point(1015, 36)}
            hitSize={[2.4, 3.0, 2.6]}
            ringRadius={1.08}
            badgeHeight={2.55}
            isInRange={nearbyZoneId === "zone-bank-lobby"}
            isTargeted={targetedZoneId === "zone-bank-lobby"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
        </>
      )}
    </group>
  );
}

function AdireMarketStrip({
  spec,
  point,
  nearbyZoneId = null,
  targetedZoneId = null,
  onSelectZone,
  onHoverZone,
}: {
  spec: AdireMarketSpec;
  point: PointFn;
} & InteractiveProps) {
  const unit = WORLD_SCALE.neighborhoodUnit;
  const lateriteMap = useMemo(() => lateriteGroundTexture(), []);
  const adireClothMap = useMemo(() => adireIndigoClothTexture(), []);
  const shedPos = point(spec.dyeShed.x, spec.dyeShed.y);
  const shedW = spec.dyeShed.width * unit;
  const shedD = spec.dyeShed.height * unit;
  const bukaPos = point(spec.bukaStall.x, spec.bukaStall.y);
  const bukaW = spec.bukaStall.width * unit;
  const bukaD = spec.bukaStall.height * unit;

  return (
    <group name="adire-market-strip" raycast={() => null}>
      {/* 1. Warm laterite earth strips */}
      {spec.yards.map((yard, idx) => {
        const yp = point(yard.x, yard.y);
        return (
          <mesh key={`adire-yard-${idx}`} position={[yp[0], 0.025, yp[2]]} receiveShadow>
            <boxGeometry args={[yard.width * unit, 0.04, yard.height * unit]} />
            <meshStandardMaterial map={lateriteMap} color="#d69567" roughness={0.96} />
          </mesh>
        );
      })}

      {/* 2. Corrugated Zinc Dye Shed */}
      <group position={[shedPos[0], 0, shedPos[2]]}>
        {[-shedW * 0.44, 0, shedW * 0.44].flatMap((px) =>
          [-shedD * 0.42, shedD * 0.42].map((pz) => (
            <mesh key={`shed-post-${px}-${pz}`} position={[px, 1.32, pz]} castShadow>
              <boxGeometry args={[0.14, 2.64, 0.14]} />
              <meshStandardMaterial color={WORLD_PALETTE.timber} roughness={0.9} />
            </mesh>
          )),
        )}
        <mesh position={[0, 2.74, 0]} rotation={[0.08, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[shedW + 0.45, 0.09, shedD + 0.45]} />
          <meshStandardMaterial color="#b0b8c0" roughness={0.55} metalness={0.35} />
        </mesh>
      </group>

      {/* 3. Indigo Dye Vats under the Zinc Shed */}
      {spec.dyeVats.map((vat, idx) => {
        const vp = point(vat.x, vat.y);
        return (
          <group key={`dye-vat-${idx}`} position={[vp[0], 0.04, vp[2]]}>
            <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.42, 0.36, 0.68, 14]} />
              <meshStandardMaterial color="#9a8b7a" roughness={0.92} />
            </mesh>
            <mesh position={[0, 0.63, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.06, 14]} />
              <meshStandardMaterial color="#16225C" roughness={0.28} metalness={0.12} />
            </mesh>
          </group>
        );
      })}

      {/* 4. Wooden Drying Racks Draped with Deep Indigo (#16225C) Adire Cloth */}
      {spec.dryingRacks.map((rack) => {
        const rp = point(rack.x, rack.y);
        const rw = rack.width * unit;
        return (
          <group key={rack.id} position={[rp[0], 0.04, rp[2]]} rotation={[0, rack.rotation, 0]}>
            {[-rw * 0.44, rw * 0.44].map((rx, idx) => (
              <mesh key={`rack-post-${idx}`} position={[rx, 0.95, 0]} castShadow>
                <boxGeometry args={[0.1, 1.9, 0.1]} />
                <meshStandardMaterial color={WORLD_PALETTE.timber} roughness={0.88} />
              </mesh>
            ))}
            <mesh position={[0, 1.82, 0]} castShadow>
              <boxGeometry args={[rw, 0.08, 0.08]} />
              <meshStandardMaterial color={WORLD_PALETTE.timber} roughness={0.88} />
            </mesh>
            {[-rw * 0.24, rw * 0.22].map((cx, cIdx) => (
              <group key={`adire-sheet-${cIdx}`} position={[cx, 1.18, 0]}>
                <mesh position={[0, 0, 0.07]} rotation={[0.04, 0, 0]} castShadow>
                  <boxGeometry args={[rw * 0.4, 1.24, 0.03]} />
                  <meshStandardMaterial map={adireClothMap} color="#26388d" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0, -0.07]} rotation={[-0.04, 0, 0]} castShadow>
                  <boxGeometry args={[rw * 0.4, 1.24, 0.03]} />
                  <meshStandardMaterial map={adireClothMap} color="#16225C" roughness={0.9} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}

      {/* 5. Market Tables with Umbrellas & Folded Cloth Bundles */}
      {spec.marketTables.map((table, idx) => {
        const tp = point(table.x, table.y);
        return (
          <group key={table.id} position={[tp[0], 0.04, tp[2]]}>
            {[-0.65, 0.65].flatMap((lx) =>
              [-0.36, 0.36].map((lz) => (
                <mesh key={`leg-${lx}-${lz}`} position={[lx, 0.38, lz]} castShadow>
                  <boxGeometry args={[0.08, 0.76, 0.08]} />
                  <meshStandardMaterial color={WORLD_PALETTE.timber} roughness={0.9} />
                </mesh>
              )),
            )}
            <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.55, 0.08, 0.92]} />
              <meshStandardMaterial color="#a6794d" roughness={0.85} />
            </mesh>
            <mesh position={[-0.38, 0.92, 0]} castShadow>
              <boxGeometry args={[0.45, 0.2, 0.4]} />
              <meshStandardMaterial map={adireClothMap} color="#16225C" roughness={0.92} />
            </mesh>
            <mesh position={[0.32, 0.9, 0.05]} castShadow>
              <boxGeometry args={[0.42, 0.16, 0.38]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? "#d97706" : "#dc2626"}
                roughness={0.88}
              />
            </mesh>
            <mesh position={[0.55, 1.38, -0.25]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 2.2, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.45} />
            </mesh>
            <mesh position={[0.55, 2.42, -0.25]} castShadow>
              <coneGeometry args={[1.15, 0.45, 8]} />
              <meshStandardMaterial color={table.umbrellaColor} roughness={0.78} />
            </mesh>
          </group>
        );
      })}

      {/* 6. Mama Sikira Buka Food Stall (cooking pots, serving counter & shade awning) */}
      <group position={[bukaPos[0], 0.04, bukaPos[2]]}>
        {/* Four wooden awning posts */}
        {[-bukaW * 0.45, bukaW * 0.45].flatMap((px) =>
          [-bukaD * 0.42, bukaD * 0.42].map((pz) => (
            <mesh key={`buka-post-${px}-${pz}`} position={[px, 1.15, pz]} castShadow>
              <boxGeometry args={[0.09, 2.3, 0.09]} />
              <meshStandardMaterial color={WORLD_PALETTE.timber} roughness={0.9} />
            </mesh>
          )),
        )}
        {/* Zinc & ochre buka awning */}
        <mesh position={[0, 2.32, 0]} rotation={[0.08, 0, 0]} castShadow>
          <boxGeometry args={[bukaW + 0.35, 0.08, bukaD + 0.35]} />
          <meshStandardMaterial color="#b45309" roughness={0.68} />
        </mesh>
        {/* Serving counter table */}
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <boxGeometry args={[bukaW * 0.9, 0.84, bukaD * 0.65]} />
          <meshStandardMaterial color="#9c6c3f" roughness={0.85} />
        </mesh>
        {/* Twin steaming steel cooking pots */}
        {[-0.36, 0.32].map((potX, pIdx) => (
          <group key={`buka-pot-${pIdx}`} position={[potX, 0.98, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.24, 0.21, 0.28, 12]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.65} />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.04, 12]} />
              <meshStandardMaterial color={pIdx === 0 ? "#c2410c" : "#15803d"} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 7. Instanced Wooden Crates */}
      <InstancedMarketCrates crates={spec.crates} point={point} />

      {/* 8. Adire & Market Interactables */}
      {onSelectZone && (
        <>
          <InteractableZone
            id="zone-adire-vats"
            promptLabel="Dye Adire"
            position={shedPos}
            hitSize={[shedW + 0.4, 2.7, shedD + 0.4]}
            ringRadius={1.15}
            badgeHeight={2.6}
            isInRange={nearbyZoneId === "zone-adire-vats"}
            isTargeted={targetedZoneId === "zone-adire-vats"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-adire-racks"
            promptLabel="Fold Adire"
            position={point(15, 92)}
            hitSize={[2.6, 2.2, 2.8]}
            ringRadius={1.05}
            badgeHeight={2.35}
            isInRange={nearbyZoneId === "zone-adire-racks"}
            isTargeted={targetedZoneId === "zone-adire-racks"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-market-stalls"
            promptLabel="Market Stalls"
            position={point(-10, 325)}
            hitSize={[3.2, 2.5, 1.8]}
            ringRadius={1.08}
            badgeHeight={2.5}
            isInRange={nearbyZoneId === "zone-market-stalls"}
            isTargeted={targetedZoneId === "zone-market-stalls"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-buka-stall"
            promptLabel="Buka Meals"
            position={bukaPos}
            hitSize={[2.2, 2.4, 1.8]}
            ringRadius={1.02}
            badgeHeight={2.45}
            isInRange={nearbyZoneId === "zone-buka-stall"}
            isTargeted={targetedZoneId === "zone-buka-stall"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
        </>
      )}
    </group>
  );
}

function WalkInLockUpShop({
  shop,
  point,
  playerScenePoint,
}: {
  shop: CommercialShopsSpec["shops"][number];
  point: PointFn;
  playerScenePoint: WorldPoint | null;
}) {
  const unit = WORLD_SCALE.neighborhoodUnit;
  const sp = point(shop.x, shop.y);
  const sw = shop.width * unit;
  const sd = shop.height * unit;
  const wallH = 2.85;
  const wallThick = 10 * unit;
  const doorW = (shop.doorWidth ?? 46) * unit;
  const westSegD = (sd - doorW) / 2;

  const playerInside = useMemo(() => {
    if (!playerScenePoint || !shop.interiorBounds) return false;
    const b = shop.interiorBounds;
    return (
      playerScenePoint.x >= b.left - 4 &&
      playerScenePoint.x <= b.right + 4 &&
      playerScenePoint.y >= b.top - 4 &&
      playerScenePoint.y <= b.bottom + 4
    );
  }, [playerScenePoint, shop.interiorBounds]);

  const roofRef = useInteriorRoofFade(playerInside);

  return (
    <group position={[sp[0], 0, sp[2]]} userData={{ occluder: true }}>
      {/* Raised interior tile floor */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[sw + 0.14, 0.08, sd + 0.14]} />
        <meshStandardMaterial color="#ece7dc" roughness={0.78} />
      </mesh>
      {/* North, South, East solid walls */}
      <mesh position={[0, wallH / 2 + 0.08, -sd / 2 + wallThick / 2]} castShadow receiveShadow>
        <boxGeometry args={[sw, wallH, wallThick]} />
        <meshStandardMaterial color="#f1ece1" roughness={0.86} />
      </mesh>
      <mesh position={[0, wallH / 2 + 0.08, sd / 2 - wallThick / 2]} castShadow receiveShadow>
        <boxGeometry args={[sw, wallH, wallThick]} />
        <meshStandardMaterial color="#f1ece1" roughness={0.86} />
      </mesh>
      <mesh position={[sw / 2 - wallThick / 2, wallH / 2 + 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThick, wallH, sd]} />
        <meshStandardMaterial color="#e6dfd0" roughness={0.86} />
      </mesh>
      {/* West storefront walls flanking open doorway */}
      {[-1, 1].map((side) => (
        <group
          key={`shop-west-${side}`}
          position={[-sw / 2 + wallThick / 2, 0.08, side * (doorW / 2 + westSegD / 2)]}
        >
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[wallThick, 0.9, westSegD]} />
            <meshStandardMaterial color={shop.accent} roughness={0.75} />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <boxGeometry args={[wallThick * 0.45, 1.3, westSegD * 0.8]} />
            <meshStandardMaterial color="#bae6fd" transparent opacity={0.55} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.52, 0]} castShadow>
            <boxGeometry args={[wallThick, 0.65, westSegD]} />
            <meshStandardMaterial color="#f1ece1" roughness={0.86} />
          </mesh>
        </group>
      ))}
      {/* Doorway header transom, signboard & open awning */}
      <mesh position={[-sw / 2 + wallThick / 2, 2.55, 0]} castShadow>
        <boxGeometry args={[wallThick, 0.6, doorW]} />
        <meshStandardMaterial color={shop.accent} roughness={0.65} />
      </mesh>
      <mesh position={[-sw / 2 - 0.28, wallH - 0.15, 0]} rotation={[0, 0, 0.16]} castShadow>
        <boxGeometry args={[0.65, 0.08, sd * 0.94]} />
        <meshStandardMaterial color={shop.accent} roughness={0.55} />
      </mesh>
      <mesh position={[-sw / 2 - 0.04, wallH + 0.18, 0]}>
        <boxGeometry args={[0.08, 0.44, sd * 0.9]} />
        <meshStandardMaterial color={shop.accent} roughness={0.45} />
      </mesh>

      {/* Interior Furniture by Shop Kind */}
      {shop.kind === "barber" ? (
        <group position={[sw / 2 - 0.52, 0.08, 0]}>
          {/* Barber station shelf & wall mirror */}
          <mesh position={[0.14, 0.45, 0]} castShadow>
            <boxGeometry args={[0.38, 0.9, 1.35]} />
            <meshStandardMaterial color={WORLD_PALETTE.timber} roughness={0.7} />
          </mesh>
          <mesh position={[0.32, 1.45, 0]}>
            <boxGeometry args={[0.04, 1.05, 1.15]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.12} metalness={0.75} />
          </mesh>
          {/* Barber chair */}
          <mesh position={[-0.45, 0.35, 0]} castShadow>
            <boxGeometry args={[0.45, 0.55, 0.45]} />
            <meshStandardMaterial color="#1d4ed8" roughness={0.55} />
          </mesh>
        </group>
      ) : (
        <group position={[sw / 2 - 0.52, 0.08, 0]}>
          {/* Accessory boutique display counter & folded packs */}
          <mesh position={[0.04, 0.48, 0]} castShadow>
            <boxGeometry args={[0.48, 0.96, 1.45]} />
            <meshStandardMaterial color="#78563a" roughness={0.78} />
          </mesh>
          <mesh position={[0.04, 1.06, -0.35]} castShadow>
            <boxGeometry args={[0.32, 0.24, 0.26]} />
            <meshStandardMaterial color="#16225C" roughness={0.85} />
          </mesh>
          <mesh position={[0.04, 1.08, 0.32]} castShadow>
            <boxGeometry args={[0.28, 0.28, 0.28]} />
            <meshStandardMaterial color="#92400e" roughness={0.75} />
          </mesh>
        </group>
      )}

      {/* Barber Pole */}
      {shop.kind === "barber" && (
        <group position={[-sw / 2 - 0.18, 1.45, sd * 0.38]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.72, 10]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.095, 0.095, 0.18, 10]} />
            <meshStandardMaterial color="#dc2626" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.095, 0.095, 0.18, 10]} />
            <meshStandardMaterial color="#2563eb" roughness={0.4} />
          </mesh>
        </group>
      )}

      {/* Auto-fading Corrugated Zinc Roof */}
      <group ref={roofRef} position={[0, wallH + 0.08, 0]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[sw + 0.24, 0.2, sd + 0.24]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.6} metalness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function CommercialShopsStrip({
  spec,
  point,
  playerScenePoint,
  nearbyZoneId = null,
  targetedZoneId = null,
  onSelectZone,
  onHoverZone,
}: {
  spec: CommercialShopsSpec;
  point: PointFn;
} & InteractiveProps) {
  const unit = WORLD_SCALE.neighborhoodUnit;
  const shoulderMap = useMemo(() => asphaltShoulderTexture(), []);
  const bayPos = point(spec.shoulderBay.x, spec.shoulderBay.y);

  return (
    <group name="commercial-shops-strip" raycast={() => null}>
      {/* 1. Keke Napep & Korope Loading Shoulder */}
      <mesh position={[bayPos[0], 0.033, bayPos[2]]} receiveShadow>
        <boxGeometry
          args={[spec.shoulderBay.width * unit, 0.052, spec.shoulderBay.height * unit]}
        />
        <meshStandardMaterial map={shoulderMap} color="#7d8287" roughness={0.9} />
      </mesh>

      {/* 2. Single-Story Lock-Up Shops (Walk-in Barber & Accessories + POS Kiosks) */}
      {spec.shops.map((shop) => {
        if (shop.walkIn) {
          return (
            <WalkInLockUpShop
              key={shop.id}
              shop={shop}
              point={point}
              playerScenePoint={playerScenePoint}
            />
          );
        }

        const sp = point(shop.x, shop.y);
        const sw = shop.width * unit;
        const sd = shop.height * unit;
        const sh = 2.55;

        return (
          <group key={shop.id} position={[sp[0], 0, sp[2]]} userData={{ occluder: true }}>
            <mesh position={[0, 0.1, 0]} receiveShadow>
              <boxGeometry args={[sw + 0.18, 0.2, sd + 0.18]} />
              <meshStandardMaterial color={WORLD_PALETTE.concrete} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.2 + sh / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[sw, sh, sd]} />
              <meshStandardMaterial color="#fef3c7" roughness={0.86} />
            </mesh>
            <mesh position={[-sw / 2 - 0.28, sh - 0.45, 0]} rotation={[0, 0, 0.16]} castShadow>
              <boxGeometry args={[0.65, 0.08, sd * 0.92]} />
              <meshStandardMaterial color={shop.accent} roughness={0.55} />
            </mesh>
            <mesh position={[-sw / 2 - 0.04, sh + 0.15, 0]}>
              <boxGeometry args={[0.08, 0.48, sd * 0.88]} />
              <meshStandardMaterial color={shop.accent} roughness={0.45} />
            </mesh>
            <mesh position={[-sw / 2 - 0.02, 1.15, 0]}>
              <boxGeometry args={[0.05, 1.45, sd * 0.65]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.45} metalness={0.45} />
            </mesh>
            <mesh position={[0, 0.2 + sh + 0.12, 0]} castShadow>
              <boxGeometry args={[sw + 0.24, 0.2, sd + 0.24]} />
              <meshStandardMaterial color="#9ca3af" roughness={0.6} metalness={0.3} />
            </mesh>
            <group position={[-sw / 2 - 0.48, 0, -sd * 0.3]}>
              <mesh position={[0, 1.18, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.035, 2.36, 8]} />
                <meshStandardMaterial color="#475569" metalness={0.45} />
              </mesh>
              <mesh position={[0, 2.32, 0]} castShadow>
                <coneGeometry args={[1.05, 0.42, 8]} />
                <meshStandardMaterial color="#eab308" roughness={0.72} />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* 3. Keke Napep Tricycles */}
      {spec.kekeVehicles.map((keke, idx) => {
        const kp = point(keke.x, keke.y);
        return (
          <group
            key={`keke-${idx}`}
            position={[kp[0], 0.055, kp[2]]}
            rotation={[0, keke.rotation, 0]}
          >
            <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.88, 0.56, 1.32]} />
              <meshStandardMaterial color={keke.color} roughness={0.45} />
            </mesh>
            <mesh position={[0, 1.08, -0.05]} castShadow>
              <boxGeometry args={[0.86, 0.12, 1.18]} />
              <meshStandardMaterial color="#18181b" roughness={0.85} />
            </mesh>
            {[-0.38, 0.38].flatMap((sx) =>
              [-0.45, 0.38].map((sz) => (
                <mesh key={`keke-strut-${sx}-${sz}`} position={[sx, 0.85, sz]}>
                  <boxGeometry args={[0.05, 0.45, 0.05]} />
                  <meshStandardMaterial color="#334155" />
                </mesh>
              )),
            )}
            <mesh position={[0, 0.85, 0.54]}>
              <boxGeometry args={[0.72, 0.38, 0.04]} />
              <meshStandardMaterial color="#bae6fd" roughness={0.2} transparent opacity={0.7} />
            </mesh>
            {[
              [0, 0.14, 0.52],
              [-0.42, 0.14, -0.42],
              [0.42, 0.14, -0.42],
            ].map(([wx, wy, wz], wIdx) => (
              <mesh
                key={`keke-wheel-${wIdx}`}
                position={[wx!, wy!, wz!]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.14, 0.14, 0.09, 10]} />
                <meshStandardMaterial color="#18181b" roughness={0.92} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* 4. Yellow Korope Minibus */}
      {spec.koropeBuses.map((bus, idx) => {
        const bp = point(bus.x, bus.y);
        return (
          <group
            key={`korope-${idx}`}
            position={[bp[0], 0.055, bp[2]]}
            rotation={[0, bus.rotation, 0]}
          >
            <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.18, 1.18, 2.38]} />
              <meshStandardMaterial color="#facc15" roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.62, 0]}>
              <boxGeometry args={[1.21, 0.14, 2.4]} />
              <meshStandardMaterial color="#18181b" roughness={0.75} />
            </mesh>
            <mesh position={[0, 0.96, 1.2]}>
              <boxGeometry args={[1.02, 0.46, 0.03]} />
              <meshStandardMaterial color="#334155" roughness={0.2} metalness={0.3} />
            </mesh>
            {[-0.595, 0.595].map((sx, sIdx) => (
              <mesh key={`korope-win-${sIdx}`} position={[sx, 0.96, -0.1]}>
                <boxGeometry args={[0.02, 0.4, 1.65]} />
                <meshStandardMaterial color="#334155" roughness={0.2} metalness={0.3} />
              </mesh>
            ))}
            <mesh position={[0, 1.38, -0.15]} castShadow>
              <boxGeometry args={[0.96, 0.12, 1.65]} />
              <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.4} />
            </mesh>
            {[-0.56, 0.56].flatMap((wx) =>
              [-0.78, 0.78].map((wz) => (
                <mesh
                  key={`korope-wheel-${wx}-${wz}`}
                  position={[wx, 0.17, wz]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.17, 0.17, 0.12, 10]} />
                  <meshStandardMaterial color="#18181b" roughness={0.9} />
                </mesh>
              )),
            )}
          </group>
        );
      })}

      {/* 5. Commercial Shops & Transit Stand Interactables */}
      {onSelectZone && (
        <>
          <InteractableZone
            id="zone-shop-barber"
            promptLabel="Barber Shop"
            position={point(1515, 65)}
            hitSize={[2.6, 3.0, 2.4]}
            ringRadius={1.0}
            badgeHeight={2.65}
            isInRange={nearbyZoneId === "zone-shop-barber"}
            isTargeted={targetedZoneId === "zone-shop-barber"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-shop-pos"
            promptLabel="POS Kiosk"
            position={point(1515, 190)}
            hitSize={[2.0, 2.5, 1.8]}
            ringRadius={0.95}
            badgeHeight={2.5}
            isInRange={nearbyZoneId === "zone-shop-pos"}
            isTargeted={targetedZoneId === "zone-shop-pos"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-shop-accessory"
            promptLabel="Accessories"
            position={point(1515, 345)}
            hitSize={[2.6, 3.0, 2.4]}
            ringRadius={1.0}
            badgeHeight={2.65}
            isInRange={nearbyZoneId === "zone-shop-accessory"}
            isTargeted={targetedZoneId === "zone-shop-accessory"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
          <InteractableZone
            id="zone-transit-stand"
            promptLabel="Board Korope"
            position={point(1362, 290)}
            hitSize={[2.2, 2.4, 5.0]}
            ringRadius={1.12}
            badgeHeight={2.35}
            isInRange={nearbyZoneId === "zone-transit-stand"}
            isTargeted={targetedZoneId === "zone-transit-stand"}
            onSelect={onSelectZone}
            {...(onHoverZone ? { onHoverChange: onHoverZone } : {})}
          />
        </>
      )}
    </group>
  );
}

export function ZoneSurroundings({
  layout,
  point,
  playerScenePoint = null,
  nearbyZoneId = null,
  targetedZoneId = null,
  onSelectZone,
  onHoverZone,
}: {
  layout: NeighborhoodZoneLayout;
  point: PointFn;
} & InteractiveProps) {
  return (
    <group name="neighborhood-zone-surroundings">
      <ServiceAlley alley={layout.serviceAlley} point={point} />
      <CommercialBank
        spec={layout.bank}
        point={point}
        playerScenePoint={playerScenePoint}
        nearbyZoneId={nearbyZoneId}
        targetedZoneId={targetedZoneId}
        {...(onSelectZone ? { onSelectZone } : {})}
        {...(onHoverZone ? { onHoverZone } : {})}
      />
      <AdireMarketStrip
        spec={layout.adireMarket}
        point={point}
        playerScenePoint={playerScenePoint}
        nearbyZoneId={nearbyZoneId}
        targetedZoneId={targetedZoneId}
        {...(onSelectZone ? { onSelectZone } : {})}
        {...(onHoverZone ? { onHoverZone } : {})}
      />
      <CommercialShopsStrip
        spec={layout.commercialShops}
        point={point}
        playerScenePoint={playerScenePoint}
        nearbyZoneId={nearbyZoneId}
        targetedZoneId={targetedZoneId}
        {...(onSelectZone ? { onSelectZone } : {})}
        {...(onHoverZone ? { onHoverZone } : {})}
      />
    </group>
  );
}
