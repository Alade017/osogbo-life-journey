import { useCallback, useState } from "react";
import { R3FNeighborhoodSurface } from "@/components/game/R3FNeighborhoodSurface";
import { CITY_CENTRE_AREA } from "@/game/neighborhood-model";
import {
  HOME_MAP_ANCHOR,
  OLAIYA_ORIGIN,
  OLAIYA_SCENE_BOUNDS,
  type NeighborhoodLandmarkSpec,
} from "@/data/neighborhoodLocations";
import { WORLD_SCALE } from "@/components/3d/world-theme";
import { SceneHtml } from "@/components/3d/SceneHtml";
import { MapCameraRig } from "./MapCameraRig";

const district = { area: CITY_CENTRE_AREA, origin: OLAIYA_ORIGIN, personalHome: true };
const noop = () => {};
const empty = [];
const overviewTarget = [0, 0, 0] as const;

function Marker({
  position,
  color,
  selected = false,
  onSelect,
}: {
  position: readonly [number, number];
  color: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <group
      position={[position[0], 0, position[1]]}
      onClick={(event) => {
        if (!onSelect) return;
        event.stopPropagation();
        if (event.delta <= 5) onSelect();
      }}
    >
      <mesh position={[0, 4, 0]} castShadow>
        <octahedronGeometry args={[selected ? 0.85 : 0.65]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 3.5, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[selected ? 1.1 : 0.7, selected ? 1.35 : 0.85, 32]} />
        <meshBasicMaterial color={color} depthWrite={false} />
      </mesh>
      {onSelect && (
        <mesh position={[0, 3, 0]}>
          <sphereGeometry args={[1.4, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** The actual playable neighborhood, rendered read-only with destination selection. */
export function NeighborhoodWorldOverview({
  landmarks,
  selected,
  player,
  focus,
  resetKey,
  onSelect,
  onManual,
}: {
  landmarks: readonly NeighborhoodLandmarkSpec[];
  selected: NeighborhoodLandmarkSpec | null;
  player: readonly [number, number];
  focus: "overview" | "player" | "destination" | "free";
  resetKey: number;
  onSelect: (landmark: NeighborhoodLandmarkSpec) => void;
  onManual: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const setScene = useCallback(noop, []);
  const target =
    focus === "player"
      ? ([player[0], 0, player[1]] as const)
      : focus === "destination" && selected
        ? ([selected.world3D[0], 0, selected.world3D[1]] as const)
        : overviewTarget;
  return (
    <R3FNeighborhoodSurface
      players={empty}
      npcs={empty}
      interactionTargets={empty}
      selfSessionId="map-overview"
      homeTypeId={null}
      district={district}
      zoom={1}
      onZoomChange={noop}
      onGroundTap={noop}
      groundTarget={null}
      onScene={setScene}
      onSelectTarget={noop}
      onNpcArrive={noop}
      overview={{
        camera: (
          <MapCameraRig
            key={resetKey}
            width={OLAIYA_SCENE_BOUNDS.width * WORLD_SCALE.neighborhoodUnit}
            depth={OLAIYA_SCENE_BOUNDS.height * WORLD_SCALE.neighborhoodUnit}
            target={target}
            active={focus !== "free"}
            zoom={1.1}
            onManual={onManual}
          />
        ),
        markers: (
          <>
            <Marker position={HOME_MAP_ANCHOR.world3D} color="#ffffff" />
            <Marker position={player} color="#1E9A5F" selected />
            {landmarks.map((landmark) => (
              <group
                key={landmark.id}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setHovered(landmark.id);
                }}
                onPointerOut={() => setHovered(null)}
              >
                <Marker
                  position={landmark.world3D}
                  color={landmark.accentColor}
                  selected={selected?.id === landmark.id}
                  onSelect={() => onSelect(landmark)}
                />
                {(selected?.id === landmark.id || hovered === landmark.id) && (
                  <SceneHtml
                    position={[landmark.world3D[0], 5.6, landmark.world3D[1]]}
                    center
                    style={{ pointerEvents: "none" }}
                  >
                    <span className="ncm-world-label">{landmark.shortLabel}</span>
                  </SceneHtml>
                )}
              </group>
            ))}
          </>
        ),
      }}
    />
  );
}
