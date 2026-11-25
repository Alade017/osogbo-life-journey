import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { VenueSceneBoundary } from "@/components/game/VenueSceneBoundary";
import { createShowroomOwnership } from "./showroom-ownership";
import type { WalkPoint } from "@/game/grid-walk-path";

type Product = { id: string; url: string };
type Limits = readonly [number, number, number];
const LOAD_MARGIN = 2;
const ownership = createShowroomOwnership();
export const SHOWROOM_LOAD_RADIUS = { standard: 14, performance: 9 } as const;

function Model({ product, limits, onReady, onUnmount }: { product: Product; limits: Limits; onReady: (id: string) => void; onUnmount: (id: string) => void }) {
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
  useEffect(() => {
    const release = ownership.retain(product.url);
    onReady(product.id);
    return () => { release(); onUnmount(product.id); };
  }, [product.id, product.url, onReady, onUnmount]);
  // GLTF cache owns the shared resources. Unmounting a clone must not dispose them.
  return <group dispose={null} scale={transform.scale}><group position={transform.offset}><Clone object={scene} /></group></group>;
}

/** Reserve the URL in a committed wrapper before starting a suspending model render.
 * The reservation survives Suspense, but releases when the boundary fails or the display unloads. */
function ReservedModel(props: Parameters<typeof Model>[0]) {
  const { product } = props;
  const [reservedUrl, setReservedUrl] = useState<string | null>(null);
  useLayoutEffect(() => {
    const release = ownership.retain(product.url);
    setReservedUrl(product.url);
    return release;
  }, [product.url]);
  return reservedUrl === product.url ? <Suspense fallback={null}><Model {...props} /></Suspense> : null;
}

// Only clear a failed request on explicit retry; successful shared resources remain cached.
export function clearFailedShowroomAsset(url: string) {
  if (ownership.canClear(url)) useGLTF.clear(url);
}

export function ShowroomAsset({ product, viewer, position, radius, pinned, limits, onReady, onError, onUnmount, attempt = 0 }: {
  product: Product;
  viewer: WalkPoint;
  position: WalkPoint;
  radius: number;
  pinned: boolean;
  limits: Limits;
  onReady: (id: string) => void;
  attempt?: number;
  onError: (id: string) => void;
  onUnmount: (id: string) => void;
}) {
  const distance = Math.hypot(viewer[0] - position[0], viewer[1] - position[1]);
  const [resident, setResident] = useState(() => pinned || distance <= radius);
  const shouldMount = pinned || distance <= radius || (resident && distance <= radius + LOAD_MARGIN);
  useEffect(() => { setResident(shouldMount); }, [shouldMount]);
  // The exit radius is larger than the entry radius to avoid threshold churn.
  // Keep the error boundary mounted so failed assets do not retry on every approach.
  return <VenueSceneBoundary resetKey={`${product.url}:${attempt}`} onError={() => onError(product.id)}>
    { shouldMount && <ReservedModel key={product.url} product={product} limits={limits} onReady={onReady} onUnmount={onUnmount} /> }
  </VenueSceneBoundary>;
}
