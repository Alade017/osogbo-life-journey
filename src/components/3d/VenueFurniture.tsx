import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3, type Group } from "three";
import type { VenueFixtureKind } from "@/lib/location-venue-designs";

import { VENUE_FURNITURE } from "@/lib/venue-furniture-assets";

export { VENUE_FURNITURE };

/**
 * Scales a copy of the model so its width (x) matches `width` metres, then stands it on the floor
 * centred on the origin. Copying keeps each fixture independent of the others.
 */
export function fitFurniture(source: Group, width: number) {
  const copy = source.clone(true);
  const box = new Box3().setFromObject(copy);
  const size = box.getSize(new Vector3());
  const scale = size.x > 0 ? width / size.x : 1;
  const centre = box.getCenter(new Vector3());
  return {
    copy,
    scale,
    offset: [-centre.x * scale, -box.min.y * scale, -centre.z * scale] as [number, number, number],
  };
}

export function VenueFurnitureModel({
  kind,
  onClick,
  active,
  accentColor,
}: {
  kind: VenueFixtureKind;
  onClick: (event: { stopPropagation: () => void }) => void;
  active: boolean;
  accentColor: string;
}) {
  const entry = VENUE_FURNITURE[kind];
  if (!entry) return null;
  return (
    <LoadedFurniture
      url={entry.url}
      width={entry.width}
      onClick={onClick}
      active={active}
      accentColor={accentColor}
    />
  );
}

function LoadedFurniture({
  url,
  width,
  onClick,
  active,
  accentColor,
}: {
  url: string;
  width: number;
  onClick: (event: { stopPropagation: () => void }) => void;
  active: boolean;
  accentColor: string;
}) {
  const gltf = useGLTF(url);
  const fitted = useMemo(() => fitFurniture(gltf.scene, width), [gltf.scene, width]);
  return (
    <group onClick={onClick}>
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[width * 0.62, 28]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      <primitive object={fitted.copy} scale={fitted.scale} position={fitted.offset} />
    </group>
  );
}
