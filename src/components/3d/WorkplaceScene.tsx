import { WorldMaterial } from "./WorldScene";
import { WORLD_PALETTE, type WorldTone } from "./world-theme";
import {
  WORKPLACE_LAYOUT,
  WORKPLACE_FOOTPRINTS,
  type WorkplaceFeature,
} from "@/game/workplace-layout";
import type { VenueFixture } from "@/lib/location-venue-designs";

type Point = [number, number, number];
function Block({
  at,
  size,
  tone = "wall",
  color,
}: {
  at: Point;
  size: Point;
  tone?: WorldTone;
  color?: string;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <WorldMaterial tone={tone} {...(color === undefined ? {} : { color })} />
    </mesh>
  );
}
function Chair() {
  return (
    <group>
      <Block at={[0, 0.5, 0]} size={[0.65, 0.12, 0.65]} tone="slate" />
      <Block at={[0, 0.9, -0.28]} size={[0.65, 0.75, 0.1]} tone="slate" />
      <Block at={[0, 0.25, 0]} size={[0.1, 0.5, 0.1]} tone="metal" />
      <Block at={[0, 0.06, 0]} size={[0.6, 0.08, 0.5]} tone="metal" />
    </group>
  );
}
function Monitor() {
  return (
    <group>
      <Block at={[0, 0.22, 0]} size={[0.06, 0.44, 0.08]} tone="metal" />
      <Block at={[0, 0.5, 0]} size={[0.85, 0.55, 0.08]} tone="slate" />
      <Block at={[0, 0.5, 0.045]} size={[0.73, 0.43, 0.02]} tone="glass" />
    </group>
  );
}
function Table({ width = 3.5, depth = 1.6 }: { width?: number; depth?: number }) {
  return (
    <group>
      <Block at={[0, 0.82, 0]} size={[width, 0.12, depth]} tone="linen" />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Block
            key={x + ":" + z}
            at={[x * (width / 2 - 0.18), 0.4, z * (depth / 2 - 0.18)]}
            size={[0.08, 0.8, 0.08]}
            tone="metal"
          />
        )),
      )}
    </group>
  );
}
function Feature({ purpose }: { purpose?: WorkplaceFeature | undefined }) {
  if (purpose === "workstations")
    return (
      <group name="workstation-island">
        <Table />
        {[-0.95, 0.95].flatMap((x) =>
          [-1, 1].map((side) => (
            <group key={x + ":" + side}>
              <group position={[x, 0.88, side * 0.18]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
                <Monitor />
              </group>
              <Block at={[x, 0.91, side * 0.62]} size={[0.7, 0.04, 0.2]} tone="metal" />
              <group position={[x, 0, side * 1.2]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
                <Chair />
              </group>
            </group>
          )),
        )}
      </group>
    );
  if (purpose === "presentation")
    return (
      <group name="training-screen">
        <Block at={[0, 1.85, 0]} size={[4.2, 2.25, 0.14]} tone="slate" />
        <Block at={[0, 1.85, 0.09]} size={[3.95, 2, 0.03]} tone="linen" />
        {[-1.7, 1.7].map((x) => (
          <Block key={x} at={[x, 0.6, 0]} size={[0.1, 1.2, 0.15]} tone="metal" />
        ))}
      </group>
    );
  if (purpose === "training")
    return (
      <group name="training-table">
        <Table width={3.2} depth={1.2} />
        {[-0.9, 0.9].map((x) => (
          <group key={x} position={[x, 0, 1.15]} rotation={[0, Math.PI, 0]}>
            <Chair />
          </group>
        ))}
        <Block at={[0, 0.91, 0]} size={[0.65, 0.07, 0.4]} tone="timber" />
      </group>
    );
  if (purpose === "reception")
    return (
      <group name="hub-reception">
        <Block at={[0, 0.55, 0]} size={[2.8, 1.1, 0.9]} tone="timber" />
        <Block at={[0, 1.13, 0]} size={[3, 0.12, 1.1]} tone="linen" />
        <group position={[0.7, 1.2, -0.1]}>
          <Monitor />
        </group>
      </group>
    );
  if (purpose !== "equipment") return null;
  return (
    <group name="equipment-rack">
      <Block at={[0, 1.2, -0.4]} size={[1.2, 2.4, 0.12]} tone="metal" />
      {[-0.6, 0.6].map((x) => (
        <Block key={x} at={[x, 1.2, 0]} size={[0.1, 2.4, 0.9]} tone="metal" />
      ))}
      {[0.2, 0.9, 1.6, 2.3].map((y) => (
        <group key={y}>
          <Block at={[0, y, 0]} size={[1.2, 0.1, 0.85]} tone="metal" />
          {y < 2 && <Block at={[0, y + 0.25, 0]} size={[0.8, 0.4, 0.6]} tone="slate" />}
        </group>
      ))}
    </group>
  );
}

function WindowBay({ x }: { x: number }) {
  const layout = WORKPLACE_LAYOUT;
  const window = layout.window;
  const y = window.bottom + window.height / 2;
  const z = -layout.depth / 2;
  return (
    <group name="daylight-window">
      <Block at={[x, y, z]} size={[window.width, window.height, 0.05]} tone="glass" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            at={[x + (side * window.width) / 2, y, z + 0.05]}
            size={[0.09, window.height + 0.16, 0.16]}
            tone="windowFrame"
          />
          <Block
            at={[x, y + (side * window.height) / 2, z + 0.05]}
            size={[window.width + 0.16, 0.09, 0.16]}
            tone="windowFrame"
          />
        </group>
      ))}
      <Block at={[x, y, z + 0.05]} size={[0.06, window.height, 0.12]} tone="windowFrame" />
      <Block
        at={[x, window.bottom - 0.05, z + 0.12]}
        size={[window.width + 0.25, 0.1, 0.35]}
        tone="timber"
      />
    </group>
  );
}
function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]} name="workplace-planter">
      <mesh position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.24, 0.48, 8]} />
        <WorldMaterial tone="clay" />
      </mesh>
      <Block at={[0, 0.72, 0]} size={[0.06, 0.7, 0.06]} tone="timber" />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.15, 1, 0]} rotation={[0, 0, side * 0.45]} castShadow>
          <icosahedronGeometry args={[0.4, 0]} />
          <WorldMaterial tone="foliage" />
        </mesh>
      ))}
    </group>
  );
}
function SelectionOutline({ purpose, color }: { purpose: WorkplaceFeature; color: string }) {
  const footprint = WORKPLACE_FOOTPRINTS[purpose];
  const width = footprint.width + 0.2;
  const depth = footprint.depth + 0.2;
  return (
    <group name="selected-workplace-fixture">
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[(side * width) / 2, 0.045, 0]}>
            <boxGeometry args={[0.045, 0.018, depth]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.045, (side * depth) / 2]}>
            <boxGeometry args={[width, 0.018, 0.045]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A local venue inspection; choosing a fixture never starts a shift or grants experience. */
export function WorkplaceScene({
  fixtures,
  selected,
  onSelect,
  floorColor,
  wallColor,
  accentColor,
}: {
  fixtures: readonly VenueFixture[];
  selected: string;
  onSelect: (id: string) => void;
  floorColor: string;
  wallColor: string;
  accentColor: string;
}) {
  const layout = WORKPLACE_LAYOUT;
  return (
    <group name="tech-hub-workplace">
      <Block
        at={[0, -0.1, 0]}
        size={[layout.width, 0.2, layout.depth]}
        tone="tileLight"
        color={floorColor}
      />
      {/* Window openings are gaps in the wall, rather than glass over an opaque panel. */}
      <Block
        at={[0, layout.window.bottom / 2, -layout.depth / 2]}
        size={[layout.width, layout.window.bottom, 0.15]}
        color={wallColor}
      />
      <Block
        at={[
          0,
          (layout.wallHeight + layout.window.bottom + layout.window.height) / 2,
          -layout.depth / 2,
        ]}
        size={[layout.width, layout.wallHeight - layout.window.bottom - layout.window.height, 0.15]}
        color={wallColor}
      />
      <Block
        at={[0, 2.2, -layout.depth / 2]}
        size={[7, layout.window.height, 0.15]}
        color={wallColor}
      />
      {[-1, 1].map((side) => (
        <Block
          key={side}
          at={[side * 6.55, 2.2, -layout.depth / 2]}
          size={[0.9, layout.window.height, 0.15]}
          color={wallColor}
        />
      ))}
      {layout.window.centers.map((x) => (
        <WindowBay key={x} x={x} />
      ))}
      <Block at={[-layout.width / 2, 1.8, 0]} size={[0.15, 3.6, layout.depth]} color={wallColor} />
      <Block at={[layout.width / 2, 0.25, 0]} size={[0.15, 0.5, layout.depth]} color={wallColor} />
      <Block at={[0, 3.5, -5.88]} size={[layout.width, 0.12, 0.12]} tone="timber" />
      <Block at={[-6.88, 0.12, 0]} size={[0.12, 0.24, layout.depth]} tone="timber" />
      <Block at={[-2.9, 0.012, 0.3]} size={[4.4, 0.018, 4.2]} tone="tileShade" />
      <Block at={[2.9, 0.013, -2.6]} size={[4.1, 0.018, 3]} tone="path" />
      {[-6.3, 6.3].map((x) => (
        <Plant key={x} x={x} z={-5.2} />
      ))}
      <Plant x={-6.3} z={4.9} />
      <group name="workplace-entrance" position={[0, 0, layout.depth / 2]}>
        <Block at={[0, 0.025, -0.35]} size={[layout.entranceWidth, 0.04, 0.7]} tone="timber" />
        {[-1, 1].map((side) => (
          <Block
            key={side}
            at={[(side * layout.entranceWidth) / 2, 1.35, 0]}
            size={[0.12, 2.7, 0.16]}
            tone="timber"
          />
        ))}
        <Block at={[0, 2.72, 0]} size={[layout.entranceWidth + 0.24, 0.14, 0.16]} tone="timber" />
        <group
          position={[-layout.entranceWidth / 2, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
          name="open-entry-door"
        >
          <Block
            at={[layout.entranceWidth / 2, 1.3, 0]}
            size={[layout.entranceWidth, 2.6, 0.08]}
            tone="timber"
          />
          <Block
            at={[layout.entranceWidth / 2, 1.65, 0.05]}
            size={[layout.entranceWidth - 0.3, 1.45, 0.025]}
            tone="glass"
          />
          <Block
            at={[layout.entranceWidth - 0.18, 1.05, 0.1]}
            size={[0.06, 0.3, 0.08]}
            tone="metal"
          />
        </group>
      </group>
      <Block at={[-4.2, 0.55, 2.8]} size={[4.8, 1.1, 0.15]} tone="timber" />
      <Block
        at={[0, 0.028, (layout.aisle.startZ + layout.aisle.endZ) / 2]}
        size={[layout.aisle.width, 0.025, layout.aisle.endZ - layout.aisle.startZ]}
        tone="linen"
      />
      <mesh position={[1.1, 1.4, 1.6]}>
        <boxGeometry args={[0.06, 2.8, 1.8]} />
        <meshStandardMaterial
          color={WORLD_PALETTE.glass}
          transparent
          opacity={0.25}
          roughness={0.25}
          depthWrite={false}
        />
      </mesh>
      {fixtures.map((fixture) => (
        <group
          key={fixture.id}
          position={[fixture.position[0], 0, fixture.position[1]]}
          onClick={(event) => {
            event.stopPropagation();
            if (event.delta <= 5) onSelect(fixture.id);
          }}
        >
          <Feature purpose={fixture.workplaceFeature} />
          {selected === fixture.id && fixture.workplaceFeature && (
            <SelectionOutline purpose={fixture.workplaceFeature} color={accentColor} />
          )}
        </group>
      ))}
    </group>
  );
}
