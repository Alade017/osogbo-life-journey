import { useEffect, useSyncExternalStore } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import { WORLD_SCALE } from "@/components/3d/world-theme";
import { ITEM_MODELS } from "@/components/3d/item-models";
import { FurnitureFallback } from "./HouseRoom3D";

type Listener = () => void;
const listeners = new Set<Listener>();
const thumbs = new Map<string, string>();
const queue: string[] = [];

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

/**
 * Queues a 3D picture. Keys look like "furniture:shower" (house furniture art key)
 * or "item:basic_outfit" (a slug from ITEM_MODELS). Safe to call many times.
 */
export function requestCatalogThumb(key: string) {
  if (thumbs.has(key) || queue.includes(key)) return;
  queue.push(key);
  notify();
}

/** The rendered picture (PNG data URL) once ready, otherwise null. */
export function useCatalogThumb(key: string | null | undefined): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (key ? (thumbs.get(key) ?? null) : null),
    () => null,
  );
}

/** Renders one queued model at a time in a hidden canvas. Mount once inside the catalogue. */
export function CatalogThumbnailQueue() {
  const next = useSyncExternalStore(
    subscribe,
    () => queue[0] ?? null,
    () => null,
  );
  if (!next) return null;
  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", left: -9999, top: 0, width: 256, height: 256 }}
    >
      <Canvas
        key={next}
        frameloop="demand"
        dpr={1}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [1.5, 1.2, 2.2], fov: 30 }}
      >
        <CaptureModel itemKey={next} />
      </Canvas>
    </div>
  );
}

function CaptureModel({ itemKey }: { itemKey: string }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        thumbs.set(itemKey, gl.domElement.toDataURL("image/png"));
        if (queue[0] === itemKey) queue.shift();
        notify();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [itemKey, gl]);

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 3, 2]} intensity={1.6} />
      <Center>
        <CatalogModel itemKey={itemKey} />
      </Center>
    </>
  );
}

function CatalogModel({ itemKey }: { itemKey: string }) {
  const separator = itemKey.indexOf(":");
  const kind = itemKey.slice(0, separator);
  const value = itemKey.slice(separator + 1);

  if (kind === "furniture") {
    return (
      <group scale={WORLD_SCALE.furniture}>
        <FurnitureFallback artKey={value} slotType="" />
      </group>
    );
  }

  const Model = ITEM_MODELS[value];
  return Model ? <Model /> : null;
}
