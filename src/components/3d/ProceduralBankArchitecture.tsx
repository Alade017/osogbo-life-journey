import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  CanvasTexture,
  DataTexture,
  DoubleSide,
  FrontSide,
  Group,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Object3D,
  SRGBColorSpace,
} from "three";
import {
  BANK_BRANCH_DESIGNS,
  BANK_WORLD,
  isBankWalkSurface,
  type BankShape,
  type BankPart,
  type BankPoint,
  type BankSurface,
  type BankWorldLayout,
} from "@/game/bank-world-layout";
import { bankMaterialStyle, bankTexturePixels } from "@/game/bank-materials";
import type { BankSlug } from "@/lib/bank-branch-data";

function BankSign({
  text,
  position,
  width,
  brand,
}: {
  text: string;
  position: BankPoint;
  width: number;
  brand: string;
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = brand;
    context.fillRect(0, 0, 1024, 128);
    context.fillStyle = "#f4f8ff";
    context.font = "600 54px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 512, 66, 980);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, [text, brand]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <mesh position={position}>
      <planeGeometry args={[width, width / 8]} />
      <meshBasicMaterial map={texture} color={texture ? "white" : brand} />
    </mesh>
  );
}
function PartBatch({
  parts,
  surface,
  shape,
  color,
  branch,
  onSelect,
  onWalk,
}: {
  parts: BankPart[];
  surface: BankSurface;
  shape: BankShape;
  color: string | undefined;
  branch: BankSlug;
  onSelect: (id: string) => void;
  onWalk: (point: BankPoint) => void;
}) {
  const ref = useRef<InstancedMesh>(null),
    { invalidate } = useThree();
  const style = useMemo(() => bankMaterialStyle(branch, surface), [branch, surface]);
  const texture = useMemo(() => {
    if (!style.texture) return null;
    const map = new DataTexture(bankTexturePixels(style.texture), 256, 256);
    map.colorSpace = SRGBColorSpace;
    map.magFilter = LinearFilter;
    map.minFilter = LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = 2;
    map.needsUpdate = true;
    return map;
  }, [style.texture]);
  useEffect(() => () => texture?.dispose(), [texture]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const object = new Object3D();
    parts.forEach((part, i) => {
      object.position.set(...part.position);
      object.scale.set(...part.size);
      object.rotation.set(part.pitch ?? 0, part.yaw ?? 0, 0);
      object.updateMatrix();
      ref.current!.setMatrixAt(i, object.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
    invalidate();
  }, [parts, invalidate]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, parts.length]}
      castShadow={false}
      receiveShadow={false}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (event.delta > 5 || event.instanceId === undefined) return;
        const part = parts[event.instanceId];
        if (!part) return;
        event.stopPropagation();
        if (part.fixture) onSelect(part.fixture);
        else if (isBankWalkSurface(part)) onWalk([event.point.x, 0, event.point.z]);
      }}
    >
      {shape === "cylinder" ? (
        <cylinderGeometry args={[0.5, 0.5, 1, 10]} />
      ) : shape === "sphere" ? (
        <icosahedronGeometry args={[0.5, 1]} />
      ) : (
        <boxGeometry />
      )}
      <meshStandardMaterial
        color={color ?? style.color}
        map={texture}
        roughness={style.roughness}
        metalness={style.metalness}
        transparent={surface === "glass"}
        opacity={surface === "glass" ? 0.28 : 1}
        side={surface === "glass" ? DoubleSide : FrontSide}
        forceSinglePass
        depthWrite={surface !== "glass"}
        emissive={surface === "led" ? "#f4f8ff" : surface === "screen" ? "#68bea9" : "#000000"}
        emissiveIntensity={surface === "led" ? 0.7 : surface === "screen" ? 0.3 : 0}
      />
    </instancedMesh>
  );
}
function SecurityDoors({ x, open }: { x: number; open: boolean }) {
  const first = useRef<Group>(null),
    second = useRef<Group>(null),
    { invalidate } = useThree();
  useFrame((_, dt) => {
    let moving = false;
    for (const [ref, sign] of [
      [first, 1],
      [second, -1],
    ] as const) {
      const group = ref.current;
      if (!group) continue;
      const target = open && sign === 1 ? 1.4 : 0;
      if (Math.abs(group.rotation.y - target) > 0.001) {
        group.rotation.y += (target - group.rotation.y) * Math.min(1, dt * 8);
        moving = true;
      }
    }
    if (moving) invalidate();
  });
  useEffect(invalidate, [open, invalidate]);
  return (
    <>
      {[BANK_WORLD.innerDoorZ, BANK_WORLD.outerDoorZ].map((z, i) => (
        <group key={z} ref={i === 0 ? first : second} position={[x - 1.3, 0, z]}>
          <mesh position={[1.3, 1.3, 0]}>
            <boxGeometry args={[2.6, 2.6, 0.07]} />
            <meshStandardMaterial
              color="#9ebfc9"
              transparent
              opacity={0.28}
              depthWrite={false}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[2.4, 1.3, 0.08]}>
            <boxGeometry args={[0.06, 0.55, 0.08]} />
            <meshStandardMaterial color="#a9b4bb" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}
/** One instanced draw per material; no bank GLBs, external fonts or texture downloads. */
export function ProceduralBankArchitecture({
  branch,
  layout,
  doorsOpen = true,
  onSelect = () => {},
  onWalk = () => {},
}: {
  branch: BankSlug;
  layout: BankWorldLayout;
  doorsOpen?: boolean;
  onSelect?: (id: string) => void;
  onWalk?: (point: BankPoint) => void;
}) {
  const batches = useMemo(() => {
    const groups = new Map<
      string,
      { surface: BankSurface; shape: BankShape; color?: string; parts: BankPart[] }
    >();
    for (const part of layout.parts) {
      const shape = part.shape ?? "box",
        key = part.surface + ":" + shape + ":" + (part.color ?? "");
      const batch = groups.get(key) ?? {
        surface: part.surface,
        shape,
        parts: [],
        ...(part.color ? { color: part.color } : {}),
      };
      batch.parts.push(part);
      groups.set(key, batch);
    }
    return [...groups.entries()];
  }, [layout]);
  return (
    <group name={`procedural-bank:${branch}:${layout.area}`}>
      {batches.map(([key, { surface, shape, color, parts }]) => (
        <PartBatch
          key={key}
          parts={parts}
          surface={surface}
          shape={shape}
          color={color}
          branch={branch}
          onSelect={onSelect}
          onWalk={onWalk}
        />
      ))}
      {layout.signs.map((sign, i) => (
        <BankSign key={sign.text + ":" + i} {...sign} brand={BANK_BRANCH_DESIGNS[branch].brand} />
      ))}
      {layout.area === "hall" && (
        <SecurityDoors x={BANK_BRANCH_DESIGNS[branch].entranceX} open={doorsOpen} />
      )}
      <hemisphereLight
        color={
          layout.area === "grounds" ? "#ffdfba" : branch === "cedar-bank" ? "#fff0d7" : "#f4f8ff"
        }
        groundColor="#657067"
        intensity={0.65}
      />
    </group>
  );
}
