import { WorldMaterial } from "./WorldScene";
import { WORLD_PALETTE, type WorldTone } from "./world-theme";
import {
  RESIDENTIAL_COMPOUND,
  compoundFeatures,
  type CompoundFeatureId,
  type residentialHomePresentation,
} from "@/game/residential-compound";
type Point = [number, number, number];
function Block({ at, size, tone = "wall" }: { at: Point; size: Point; tone?: WorldTone }) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <WorldMaterial tone={tone} />
    </mesh>
  );
}
function Frontage({ floors = 1, personal = false }: { floors?: number; personal?: boolean }) {
  const floorHeight = 2.7,
    height = floors * floorHeight;
  return (
    <group>
      <Block at={[0, 0.12, 0]} size={[6.2, 0.24, 4.2]} tone="concrete" />
      <Block at={[0, height / 2 + 0.24, 0]} size={[6, height, 4]} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.55, height + 0.65, 0]} rotation={[0, 0, side * -0.2]}>
          <Block at={[0, 0, 0]} size={[3.3, 0.14, 4.5]} tone="roof" />
        </group>
      ))}
      <Block at={[0, height + 0.98, 0]} size={[0.12, 0.1, 4.5]} tone="roofLight" />
      <Block at={[0, 1.3, 2.04]} size={[1.15, 2.1, 0.08]} tone={personal ? "indigo" : "door"} />
      <Block at={[0.36, 1.25, 2.1]} size={[0.08, 0.12, 0.04]} tone="metal" />
      {Array.from({ length: floors }, (_, floor) =>
        [-1, 1].map((side) => (
          <group key={floor + ":" + side}>
            <Block
              at={[side * 1.85, floor * floorHeight + 1.65, 2.04]}
              size={[1.3, 1.1, 0.08]}
              tone="windowFrame"
            />
            <Block
              at={[side * 1.85, floor * floorHeight + 1.65, 2.1]}
              size={[1.05, 0.88, 0.04]}
              tone="glass"
            />
          </group>
        )),
      )}
      <Block at={[0, 2.5, 2.45]} size={[3.5, 0.14, 1.25]} tone="roofLight" />
      <Block at={[0, 0.12, 2.55]} size={[2.1, 0.24, 1.1]} tone="concrete" />
    </group>
  );
}
function WaterPoint() {
  return (
    <group>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Block
            key={x + ":" + z}
            at={[x * 0.75, 1.2, z * 0.75]}
            size={[0.1, 2.4, 0.1]}
            tone="metal"
          />
        )),
      )}
      <Block at={[0, 2.4, 0]} size={[1.9, 0.12, 1.9]} tone="metal" />
      <mesh position={[0, 3.1, 0]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 1.3, 16]} />
        <WorldMaterial tone="slate" />
      </mesh>
      <Block at={[0, 3.79, 0]} size={[0.6, 0.08, 0.6]} tone="metal" />
      <Block at={[1.1, 0.7, 0.6]} size={[0.07, 1.4, 0.07]} tone="metal" />
      <Block at={[1.1, 1.35, 0.8]} size={[0.07, 0.07, 0.45]} tone="metal" />
      <Block at={[1.1, 0.04, 0.9]} size={[0.9, 0.08, 0.8]} tone="tileBath" />
    </group>
  );
}
function DryingArea() {
  return (
    <group>
      {[-1.6, 1.6].map((x) => (
        <group key={x}>
          <Block at={[x, 1.2, 0]} size={[0.09, 2.4, 0.09]} tone="metal" />
          <Block at={[x, 2.4, 0]} size={[0.09, 0.09, 1.4]} tone="metal" />
        </group>
      ))}
      {[-0.55, 0, 0.55].map((z) => (
        <Block key={z} at={[0, 2.4, z]} size={[3.2, 0.025, 0.025]} tone="linen" />
      ))}
    </group>
  );
}
export function ResidentialCompoundScene({
  home,
  selected,
  onSelect,
  onWalk,
}: {
  home: ReturnType<typeof residentialHomePresentation>;
  selected: CompoundFeatureId;
  onSelect: (id: CompoundFeatureId) => void;
  onWalk: (point: [number, number]) => void;
}) {
  const layout = RESIDENTIAL_COMPOUND,
    features = compoundFeatures(home?.sharedFacilities ?? false);
  return (
    <group name="residential-compound-courtyard">
      <Block at={[0, -0.1, 0]} size={[layout.width, 0.2, layout.depth]} tone="ground" />
      <mesh
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta <= 5) onWalk([event.point.x, event.point.z]);
        }}
      >
        <planeGeometry args={[layout.width, layout.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Block at={[0, 0.025, 3]} size={[1.8, 0.05, 13]} tone="path" />
      <Block at={[0, 0.02, 0]} size={[11, 0.04, 4.2]} tone="sidewalk" />
      <Block at={[0, 0.7, -9.8]} size={[20, 1.4, 0.15]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block at={[side * 9.8, 0.7, 0]} size={[0.15, 1.4, 20]} />
          <Block at={[side * 5.8, 0.45, 9.8]} size={[8.2, 0.9, 0.15]} />
          <Block at={[side * 1.7, 1.2, 9.8]} size={[0.25, 2.4, 0.25]} tone="concrete" />
          <group position={[side * 1.7, 0, 9.8]} rotation={[0, (side * Math.PI) / 2, 0]}>
            <Block at={[-side * 0.8, 0.75, 0]} size={[1.6, 1.5, 0.08]} tone="metal" />
          </group>
        </group>
      ))}
      {layout.privateFronts.map((front, index) => (
        <group key={index} position={[front.x, 0, front.z]} rotation={[0, front.rotation, 0]}>
          <Frontage />
        </group>
      ))}
      <group
        position={[0, 0, -5]}
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta <= 5) onSelect("home-entry");
        }}
      >
        <Frontage floors={home?.floors ?? 1} personal={!!home} />
      </group>
      {features.map((feature) => (
        <group
          key={feature.id}
          position={[feature.x, 0, feature.z]}
          onClick={(event) => {
            event.stopPropagation();
            if (event.delta <= 5) onSelect(feature.id);
          }}
        >
          {feature.id === "courtyard" ? (
            <>
              <Block at={[0, 0.5, 0]} size={[2.4, 0.14, 0.65]} tone="timber" />
              <Block at={[0, 0.85, -0.3]} size={[2.4, 0.65, 0.1]} tone="timber" />
              {[-0.9, 0.9].map((x) => (
                <Block key={x} at={[x, 0.23, 0]} size={[0.12, 0.46, 0.5]} tone="metal" />
              ))}
            </>
          ) : feature.id === "water" ? (
            <WaterPoint />
          ) : feature.id === "drying" ? (
            <DryingArea />
          ) : feature.id === "wash" ? (
            <>
              <Block at={[0, 0.1, 0]} size={[3.5, 0.2, 2.8]} tone="tileBath" />
              <Block at={[0, 1.35, -1.35]} size={[3.5, 2.7, 0.12]} />
              <Block at={[-1.7, 0.5, 0]} size={[0.12, 1, 2.8]} />
              <Block at={[1.7, 0.5, 0]} size={[0.12, 1, 2.8]} />
              <Block at={[0, 0.6, -0.7]} size={[2.8, 1.2, 0.8]} tone="concrete" />
              <Block at={[0, 1.24, -0.7]} size={[2.9, 0.08, 0.9]} tone="tileLight" />
            </>
          ) : feature.id === "gate" ? (
            <Block at={[0, 0.025, 0]} size={[3.4, 0.05, 0.7]} tone="concrete" />
          ) : null}
          {selected === feature.id && (
            <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.75, 0.85, 32]} />
              <meshBasicMaterial color={home ? WORLD_PALETTE.sign : WORLD_PALETTE.slate} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
