import type { Ref } from "react";
import type { Group } from "three";
import { WorldMaterial } from "./WorldScene";

type LimbRefs = { leftArm: Ref<Group>; rightArm: Ref<Group>; leftLeg: Ref<Group>; rightLeg: Ref<Group> };
type Props =
  | ({ detail: "resident" } & LimbRefs)
  | { detail: "zone"; shirtColor: string; accentColor: string; trouserColor: string; rightArmRef: Ref<Group>; headGroupRef: Ref<Group> }
  | { detail: "street"; color: string; waiting?: boolean };

/** Shared lightweight NPC presentation, with geometry profiles matched to scene scale. */
export function NpcBody(props: Props) {
  if (props.detail === "resident") {
    const { leftArm, rightArm, leftLeg, rightLeg } = props;
    return <>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.52, 4, 8]} />
        <WorldMaterial tone="slate" />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <WorldMaterial tone="clay" />
      </mesh>
      <group ref={leftArm} position={[-0.29, 1.08, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.12, 0.42, 0.13]} />
          <WorldMaterial tone="clay" />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.29, 1.08, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.12, 0.42, 0.13]} />
          <WorldMaterial tone="clay" />
        </mesh>
      </group>
      <group ref={leftLeg} position={[-0.12, 0.48, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.14, 0.42, 0.16]} />
          <WorldMaterial tone="timber" />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.12, 0.48, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.14, 0.42, 0.16]} />
          <WorldMaterial tone="timber" />
        </mesh>
      </group>
    </>;
  }
  if (props.detail === "zone") {
    const { rightArmRef, headGroupRef } = props;
    return <>
        {/* Ground contact shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <circleGeometry args={[0.32, 16]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.22} depthWrite={false} />
        </mesh>

        {/* Torso / uniform shirt */}
        <mesh position={[0, 0.92, 0]} castShadow>
          <capsuleGeometry args={[0.21, 0.46, 4, 8]} />
          <meshStandardMaterial color={props.shirtColor} roughness={0.75} />
        </mesh>

        {/* Accent collar / badge */}
        <mesh position={[0, 1.16, 0.14]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.12]} />
          <meshStandardMaterial color={props.accentColor} roughness={0.5} />
        </mesh>

        {/* Head */}
        <group ref={headGroupRef} position={[0, 1.5, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshStandardMaterial color="#8c583a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.18, 0.2, 0.1, 10]} />
            <meshStandardMaterial color={props.accentColor} roughness={0.65} />
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
            <meshStandardMaterial color={props.trouserColor} roughness={0.85} />
          </mesh>
        ))}
    </>;
  }
  return <>
      {/* Head */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[props.waiting ? 0.105 : 0.11, 10, 10]} />
        <WorldMaterial tone="timber" />
      </mesh>

      {/* Body / Torso Clothes */}
      <mesh position={[0, props.waiting ? 0.37 : 0.38, 0]} castShadow>
        <boxGeometry args={[props.waiting ? 0.21 : 0.22, props.waiting ? 0.31 : 0.32, 0.14]} />
        <meshStandardMaterial color={props.color} roughness={props.waiting ? 0.65 : 0.6} />
      </mesh>

      {/* Trousers / Wrapper */}
      <mesh position={[0, props.waiting ? 0.13 : 0.14, 0]} castShadow>
        <boxGeometry args={[props.waiting ? 0.19 : 0.2, props.waiting ? 0.21 : 0.22, 0.12]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>

  </>;
}
