import { Component, Suspense, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, Html, OrbitControls, useGLTF } from "@react-three/drei";

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="status" className="p-4 text-sm">3D preview unavailable. You can still browse the catalogue.</p>
    ) : this.props.children;
  }
}

function ProductModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} dispose={null} />;
}

export function ShowroomProductViewer({ url, label }: { url: string; label: string }) {
  const [rotation, setRotation] = useState(false);
  const [reset, setReset] = useState(0);
  return (
    <section aria-label={label + " 3D preview"} className="mt-3 space-y-2">
      <div className="h-56 w-full overflow-hidden rounded-lg border bg-muted sm:h-72">
        <ViewerBoundary key={url + reset}>
          <Canvas
            camera={{ position: [4, 3, 5], fov: 45 }}
            dpr={[1, 1.5]}
            frameloop={rotation ? "always" : "demand"}
            fallback={<p className="p-4 text-sm">WebGL is unavailable on this device.</p>}
          >
            <ambientLight intensity={1.1} />
            <directionalLight position={[4, 6, 5]} intensity={2} />
            <directionalLight position={[-4, 2, -3]} intensity={1} />
            <Suspense fallback={<Html center><span role="status" className="whitespace-nowrap text-sm">Loading model…</span></Html>}>
              <Bounds fit clip observe margin={1.25}>
                <Center><ProductModel url={url} /></Center>
              </Bounds>
            </Suspense>
            <OrbitControls makeDefault enablePan={false} autoRotate={rotation} autoRotateSpeed={1.2} />
          </Canvas>
        </ViewerBoundary>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={rotation} onClick={() => setRotation((value) => !value)}
          className="rounded-full border px-3 py-1.5 text-xs">
          {rotation ? "Stop rotation" : "Auto rotate"}
        </button>
        <button type="button" onClick={() => { setRotation(false); setReset((value) => value + 1); }}
          className="rounded-full border px-3 py-1.5 text-xs">Reset view</button>
        <span className="text-xs text-muted-foreground">Drag to rotate · pinch or scroll to zoom</span>
      </div>
    </section>
  );
}
