import { Component, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Clone, useGLTF } from "@react-three/drei";
import { getShowroomModels } from "@/data/showroom-models";

type Model = ReturnType<typeof getShowroomModels>[number];
type Point = [number, number, number];

class DisplayBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Block({ position, size, color }: { position: Point; size: Point; color: string }) {
  return <mesh position={position}><boxGeometry args={size} /><meshStandardMaterial color={color} /></mesh>;
}

function DisplayVehicle({ model }: { model: Model }) {
  const { scene } = useGLTF(model.url);
  return <Clone object={scene} />;
}

function Bay({ model, position, onSelect }: { model: Model; position: Point; onSelect: (id: string) => void }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]} onClick={(event) => { event.stopPropagation(); onSelect(model.id); }}>
        <boxGeometry args={[3.6, 0.24, 5.8]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      <group position={[0, 0.25, 0]}>
        <DisplayBoundary fallback={<Html center><span className="rounded bg-background px-2 py-1 text-xs">Asset pending</span></Html>}>
          <Suspense fallback={<Html center><span className="text-xs">Loading…</span></Html>}>
            <DisplayVehicle model={model} />
          </Suspense>
        </DisplayBoundary>
      </group>
      <Html position={[0, 0.65, 3.15]} center>
        <button type="button" onClick={() => onSelect(model.id)} className="whitespace-nowrap rounded-full border bg-background px-3 py-1 text-xs capitalize text-foreground">
          {model.label}
        </button>
      </Html>
    </group>
  );
}

export function MotorsShowroomScene({ models, onSelect }: { models: readonly Model[]; onSelect: (id: string) => void }) {
  const displayed = models.slice(0, 4);
  return (
    <section aria-label="Osun Motors showroom preview" className="my-3">
      <div className="h-64 overflow-hidden rounded-lg border bg-muted sm:h-96">
        <DisplayBoundary fallback={<p role="status" className="p-4 text-sm">Showroom preview unavailable. Use the catalogue below.</p>}>
          <Canvas camera={{ position: [16, 15, 20], fov: 45 }} dpr={[1, 1.5]} frameloop="demand"
            fallback={<p className="p-4 text-sm">WebGL is unavailable.</p>}>
            <color attach="background" args={["#e2e8f0"]} />
            <ambientLight intensity={1.2} />
            <directionalLight position={[6, 12, 8]} intensity={2} />
            <Block position={[0, -0.15, 0]} size={[16, 0.3, 18]} color="#d6d3d1" />
            <Block position={[0, 2, -8.8]} size={[16, 4, 0.25]} color="#334155" />
            <Block position={[-7.9, 2, 0]} size={[0.25, 4, 18]} color="#94a3b8" />
            <Block position={[7.9, 0.35, 0]} size={[0.25, 0.7, 18]} color="#94a3b8" />
            {[-6, 0, 6].map((x) => <Block key={x} position={[x, 2, 8.65]} size={[0.25, 4, 0.25]} color="#475569" />)}
            <Block position={[0, 3.85, 8.65]} size={[16, 0.3, 0.25]} color="#475569" />
            <Block position={[5.6, 0.55, -7]} size={[3, 1.1, 1.1]} color="#475569" />
            <Block position={[0, 0.015, 0]} size={[1.8, 0.03, 16]} color="#f1f5f9" />
            {displayed.map((model, index) => (
              <Bay key={model.id} model={model} position={[index % 2 === 0 ? -4 : 4, 0, index < 2 ? -4 : 4]} onSelect={onSelect} />
            ))}
            <OrbitControls makeDefault enablePan={false} minDistance={10} maxDistance={42} maxPolarAngle={Math.PI / 2.1} />
          </Canvas>
        </DisplayBoundary>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Concept showroom · orbit to explore, select a display to inspect. No travel or purchases.</p>
    </section>
  );
}
