import { useEffect, useReducer, type ComponentType } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import { ITEM_MODELS } from "./item-models";
import { hasItemThumbnail, setItemThumbnail } from "./item-thumbnails";

/** Renders one model to a PNG once, then reports back so the queue can move on. */
function Capture({
  slug,
  Model,
  onDone,
}: {
  slug: string;
  Model: ComponentType;
  onDone: () => void;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    // One frame lets the model and its centring settle before the snapshot.
    const frame = requestAnimationFrame(() => {
      gl.render(scene, camera);
      setItemThumbnail(slug, gl.domElement.toDataURL("image/png"));
      onDone();
    });
    return () => cancelAnimationFrame(frame);
  }, [gl, scene, camera, slug, onDone]);

  return (
    <Center>
      <Model />
    </Center>
  );
}

/** Makes thumbnails for every 3D item one at a time, off screen. Mount once on the wardrobe page. */
export function ItemThumbnailQueue({ slugs }: { slugs: string[] }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const pending = slugs.filter((slug) => ITEM_MODELS[slug] && !hasItemThumbnail(slug));
  const current = pending[0];
  if (!current) return null;
  const Model = ITEM_MODELS[current]!;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: -9999,
        top: 0,
        width: 256,
        height: 256,
        pointerEvents: "none",
      }}
    >
      <Canvas
        key={current}
        dpr={1}
        frameloop="demand"
        camera={{ position: [0, 1.4, 3.6], fov: 34 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 2]} intensity={1.6} />
        <Capture slug={current} Model={Model} onDone={rerender} />
      </Canvas>
    </div>
  );
}
