import { InteractionMarker } from "./InteractionMarker";
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
type FurnitureBounds = {
  width: number;
  centerX: number;
  centerZ: number;
  minY: number;
};

const furnitureBoundsCache = new WeakMap<Group, FurnitureBounds>();

function getFurnitureBounds(source: Group): FurnitureBounds {
  const cached = furnitureBoundsCache.get(source);

  if (cached) return cached;

  const box = new Box3().setFromObject(source);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());

  const bounds: FurnitureBounds = {
    width: size.x,
    centerX: centre.x,
    centerZ: centre.z,
    minY: box.min.y,
  };

  furnitureBoundsCache.set(source, bounds);

  return bounds;
}

export function fitFurniture(source: Group, width: number) {
  const bounds = getFurnitureBounds(source);
  const copy = source.clone(true);
  const scale = bounds.width > 0 ? width / bounds.width : 1;

  return {
    copy,
    scale,
    offset: [-bounds.centerX * scale, -bounds.minY * scale, -bounds.centerZ * scale] as [
      number,
      number,
      number,
    ],
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
      <InteractionMarker color={accentColor} selected={active} radius={width * 0.62} />
      <primitive object={fitted.copy} scale={fitted.scale} position={fitted.offset} />
    </group>
  );
}
