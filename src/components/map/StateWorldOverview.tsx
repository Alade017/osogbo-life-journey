import { useState } from "react";
import worldData from "@/data/osun-public-places.json";
import { SceneHtml } from "@/components/3d/SceneHtml";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { MapCameraRig } from "./MapCameraRig";
import { MapSceneViewport } from "./MapSceneViewport";

type Town = (typeof worldData.towns)[number];
/** Town coordinates are authored game positions, not a geographic survey. */
export function StateWorldOverview({
  selectedTownId,
  onSelectTown,
}: {
  selectedTownId: string;
  onSelectTown: (id: string) => void;
}) {
  const [resetKey, setResetKey] = useState(0);
  const position = (town: Town): [number, number, number] => [town.x - 50, 0, town.y - 50];
  return (
    <div className="state-world-shell">
      <MapSceneViewport label="Interactive 3D Osun town overview">
        <MapCameraRig key={resetKey} width={105} depth={85} target={[0, 0, 0]} />
        <mesh position={[0, -1, 0]} receiveShadow>
          <boxGeometry args={[108, 2, 100]} />
          <meshStandardMaterial color={WORLD_PALETTE.ground} roughness={1} />
        </mesh>
        {worldData.towns.map((town) => {
          const selected = selectedTownId === town.id;
          const [x, , z] = position(town);
          return (
            <group
              key={town.id}
              position={[x, 0, z]}
              onClick={(event) => {
                event.stopPropagation();
                onSelectTown(town.id);
              }}
            >
              <mesh position={[0, 0.18, 0]} receiveShadow>
                <cylinderGeometry args={[4.4, 4.6, 0.36, 24]} />
                <meshStandardMaterial
                  color={selected ? WORLD_PALETTE.indigo : WORLD_PALETTE.sidewalk}
                />
              </mesh>
              {[-1, 0, 1].map((offset, index) => (
                <group key={offset} position={[offset * 2.2, 0, index === 1 ? -0.6 : 0.8]}>
                  <mesh position={[0, 1.3 + index * 0.35, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.7, 2 + index * 0.7, 2]} />
                    <meshStandardMaterial
                      color={selected ? WORLD_PALETTE.linen : WORLD_PALETTE.wall}
                    />
                  </mesh>
                  <mesh
                    position={[0, 2.5 + index * 0.7, 0]}
                    castShadow
                    rotation={[0, Math.PI / 4, 0]}
                  >
                    <coneGeometry args={[1.65, 0.9, 4]} />
                    <meshStandardMaterial color={WORLD_PALETTE.roof} />
                  </mesh>
                </group>
              ))}
              {selected && (
                <mesh position={[0, 6, 0]}>
                  <octahedronGeometry args={[0.8]} />
                  <meshStandardMaterial color={WORLD_PALETTE.sign} />
                </mesh>
              )}
              <SceneHtml position={[0, 4.5, 0]} center>
                <button
                  type="button"
                  className="state-world-label"
                  aria-label={`Focus ${town.name} in 3D`}
                  aria-pressed={selected}
                  onClick={() => onSelectTown(town.id)}
                >
                  {town.name}
                </button>
              </SceneHtml>
            </group>
          );
        })}
      </MapSceneViewport>
      <button
        type="button"
        className="state-world-reset"
        onClick={() => setResetKey((value) => value + 1)}
      >
        Reset view
      </button>
      <p className="state-world-caption">Osun towns · Game overview</p>
    </div>
  );
}
