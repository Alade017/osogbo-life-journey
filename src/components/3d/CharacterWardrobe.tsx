import { useMemo } from "react";
import { createPortal } from "@react-three/fiber";
import { Bone, Object3D, Quaternion, Vector3 } from "three";
import type { Appearance } from "@/game/avatar-appearance";
import { OUTFITS, SHOE_COLORS, TROUSERS } from "@/game/avatar-appearance";
import { adireTexture } from "./cloth-patterns";

type Segment = { bone: Bone; child: Bone };
function clean(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function findBone(root: Object3D, candidates: string[]): Bone | null {
  const wanted = candidates.map(clean);
  let found: Bone | null = null;
  root.traverse((node) => {
    if (found || !(node instanceof Bone)) return;
    const name = clean(node.name);
    if (wanted.some((candidate) => name === candidate || name.endsWith(candidate))) found = node;
  });
  return found;
}
function segmentFrom(root: Object3D, candidates: string[]): Segment | null {
  const bone = findBone(root, candidates);
  if (!bone) return null;
  const child = bone.children.find((node): node is Bone => node instanceof Bone);
  return child ? { bone, child } : null;
}

function SegmentGarment({
  segment,
  color,
  trim,
  radiusFactor,
  patterned = false,
  cuff = true,
}: {
  segment: Segment;
  color: string;
  trim: string;
  radiusFactor: number;
  patterned?: boolean;
  cuff?: boolean;
}) {
  const { length, radius, rotation, midpoint } = useMemo(() => {
    const vector = segment.child.position;
    const len = Math.max(vector.length(), 0.025);
    const rad = Math.max(len * radiusFactor, 0.012);
    const rot = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      vector.clone().normalize(),
    );
    const mid = vector.clone().multiplyScalar(0.5);
    return { length: len, radius: rad, rotation: rot, midpoint: mid };
  }, [segment, radiusFactor]);
  const map = useMemo(() => (patterned ? adireTexture() : null), [patterned]);
  return (
    <group position={midpoint} quaternion={rotation}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius * 0.94, radius, length * 1.04, 12, 1]} />
        <meshStandardMaterial color={color} map={map} roughness={0.94} side={2} />
      </mesh>
      {cuff ? (
        <mesh position={[0, -length * 0.44, 0]}>
          <cylinderGeometry
            args={[radius * 0.96, radius * 0.96, Math.max(length * 0.075, 0.01), 12]}
          />
          <meshStandardMaterial color={trim} roughness={0.82} />
        </mesh>
      ) : null}
      <mesh position={[0, length * 0.2, 0]}>
        <cylinderGeometry
          args={[radius * 1.01, radius * 1.01, Math.max(length * 0.018, 0.004), 12]}
        />
        <meshStandardMaterial color={trim} roughness={0.82} />
      </mesh>
    </group>
  );
}

function ShoeGarment({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, -0.018, 0.035]} scale={[0.72, 0.42, 1.18]} castShadow>
        <sphereGeometry args={[0.055, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.038, 0.035]} scale={[0.72, 0.18, 1.15]}>
        <sphereGeometry args={[0.055, 12, 8]} />
        <meshStandardMaterial color="#282522" roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * Rig-following wardrobe panels. Garments are parented to named biped bones; missing anchors are
 * skipped instead of placing clothes at guessed world coordinates.
 */
export function CharacterWardrobe({
  rig,
  appearance,
  gender,
}: {
  rig: Object3D;
  appearance: Appearance;
  gender: string;
}) {
  const anchors = useMemo(() => {
    const torso = [
      segmentFrom(rig, ["Bip01 Spine", "Spine", "spine"]),
      segmentFrom(rig, ["Bip01 Spine1", "Spine1", "spine_1"]),
      segmentFrom(rig, ["Bip01 Spine2", "Spine2", "spine_2"]),
    ].filter((value): value is Segment => !!value);
    const arms = [
      segmentFrom(rig, ["Bip01 L UpperArm", "L UpperArm", "LeftUpperArm", "upperarm_l"]),
      segmentFrom(rig, ["Bip01 R UpperArm", "R UpperArm", "RightUpperArm", "upperarm_r"]),
      segmentFrom(rig, ["Bip01 L Forearm", "L Forearm", "LeftForeArm", "lowerarm_l"]),
      segmentFrom(rig, ["Bip01 R Forearm", "R Forearm", "RightForeArm", "lowerarm_r"]),
    ].filter((value): value is Segment => !!value);
    const legs = [
      segmentFrom(rig, ["Bip01 L Thigh", "L Thigh", "LeftUpLeg", "thigh_l"]),
      segmentFrom(rig, ["Bip01 R Thigh", "R Thigh", "RightUpLeg", "thigh_r"]),
      segmentFrom(rig, ["Bip01 L Calf", "L Calf", "LeftLeg", "calf_l"]),
      segmentFrom(rig, ["Bip01 R Calf", "R Calf", "RightLeg", "calf_r"]),
    ].filter((value): value is Segment => !!value);
    const feet = [
      findBone(rig, ["Bip01 L Foot", "L Foot", "LeftFoot", "foot_l"]),
      findBone(rig, ["Bip01 R Foot", "R Foot", "RightFoot", "foot_r"]),
    ].filter((value): value is Bone => !!value);
    return { torso, arms, legs, feet };
  }, [rig]);

  if (appearance.clothed === false) return null;
  const top = OUTFITS[appearance.outfit ?? 0] ?? OUTFITS[0]!;
  const bottom = TROUSERS[appearance.bottoms ?? 0] ?? TROUSERS[0]!;
  const shoes = SHOE_COLORS[appearance.shoes ?? 0] ?? SHOE_COLORS[0]!;
  const trim = gender === "female" ? "#c49b61" : "#d7c49a";
  const patterned = appearance.outfit === 3;

  return (
    <>
      {anchors.torso.map((segment) =>
        createPortal(
          <SegmentGarment
            segment={segment}
            color={top}
            trim={trim}
            radiusFactor={0.72}
            cuff={false}
            patterned={patterned}
          />,
          segment.bone,
        ),
      )}
      {anchors.arms.map((segment) =>
        createPortal(
          <SegmentGarment
            segment={segment}
            color={top}
            trim={trim}
            radiusFactor={0.2}
            patterned={patterned}
          />,
          segment.bone,
        ),
      )}
      {anchors.legs.map((segment) =>
        createPortal(
          <SegmentGarment segment={segment} color={bottom} trim={trim} radiusFactor={0.22} />,
          segment.bone,
        ),
      )}
      {anchors.feet.map((bone) => createPortal(<ShoeGarment color={shoes} />, bone))}
    </>
  );
}
