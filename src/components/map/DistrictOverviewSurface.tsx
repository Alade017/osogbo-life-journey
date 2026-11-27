import { Component, useEffect, useRef, type ReactNode } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OverviewModelResources } from "./OverviewModelResources";
import { DistrictOverviewWorld, type DistrictOverviewProps } from "./DistrictOverviewWorld";

class OverviewBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onUnavailable();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
function RendererLifecycle({
  onReady,
  onUnavailable,
}: {
  onReady: () => void;
  onUnavailable: () => void;
}) {
  const { gl, invalidate } = useThree();
  const firstFrame = useRef(false);
  useFrame(() => {
    if (firstFrame.current) return;
    firstFrame.current = true;
    onReady();
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    invalidate();
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [gl, invalidate, onUnavailable]);
  return null;
}
export function DistrictOverviewSurface({
  onReady,
  onUnavailable,
  ...props
}: DistrictOverviewProps & {
  onReady: () => void;
  onUnavailable: () => void;
}) {
  return (
    <OverviewBoundary onUnavailable={onUnavailable}>
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [75, 100, 95], near: 0.1, far: 500 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        fallback={<span>3D map rendering is unavailable in this browser.</span>}
      >
        <color attach="background" args={["#dce7dc"]} />
        <OverviewModelResources>
          <DistrictOverviewWorld {...props} />
          <RendererLifecycle onReady={onReady} onUnavailable={onUnavailable} />
        </OverviewModelResources>
      </Canvas>
    </OverviewBoundary>
  );
}
