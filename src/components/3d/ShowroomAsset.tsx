import { Suspense, useEffect, useMemo } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { VenueSceneBoundary } from "@/components/game/VenueSceneBoundary";
import type { WalkPoint } from "@/game/grid-walk-path";

type Product = { id: string; url: string };
type Limits = readonly [number, number, number];
const LOAD_MARGIN = 2;
export const SHOWROOM_LOAD_RADIUS = { standard: 14, performance: 9 } as const;

function Model({ product, limits, onReady }: { product: Product; limits: Limits; onReady: (id: string) => void }) {
  const { scene } = useGLTF(product.url);
  const [width, height, depth] = limits;
  const transform = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    if (box.isEmpty() || ![size.x, size.y, size.z, center.x, center.z, box.min.y].every(Number.isFinite)) {
      throw new Error("Invalid showroom model bounds");
    }
    return {
      scale: Math.min(1, width / Math.max(size.x, 0.001), height / Math.max(size.y, 0.001), depth / Math.max(size.z, 0.001)),
      offset: [-center.x, -box.min.y, -center.z] as [number, number, number],
    };
  }, [scene, width, height, depth]);
  useEffect(() => { onReady(product.id); }, [product.id, onReady]);
  // GLTF cache owns the shared resources. Unmounting a clone must not dispose them.
  return <group dispose={null} scale={transform.scale}><group position={transform.offset}><Clone object={scene} /></group></group>;
}

export function ShowroomAsset({ product, viewer, position, radius, pinned, limits, onReady, onError }: {
  product: Product;
  viewer: WalkPoint;
  position: WalkPoint;
  radius: number;
  pinned: boolean;
  limits: Limits;
  onReady: (id: string) => void;
  onError: (id: string) => void;
}) {
  const distance = Math.hypot(viewer[0] - position[0], viewer[1] - position[1]);
  // Keep a small buffer around the near zone so the inspection target never disappears.
  // The boundary stays mounted while its model is outside the render distance.
  return <VenueSceneBoundary resetKey={product.url} onError={() => onError(product.id)}>
    { (pinned || distance <= radius + LOAD_MARGIN) && <Suspense fallback={null}><Model product={product} limits={limits} onReady={onReady} /></Suspense> }
  </VenueSceneBoundary>;
}
