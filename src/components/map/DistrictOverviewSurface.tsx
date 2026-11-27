import { Component, useEffect, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OverviewModelResources } from "./OverviewModelResources";
import { DistrictOverviewWorld, type DistrictOverviewProps } from "./DistrictOverviewWorld";

class OverviewBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onUnavailable(); }
  override render() { return this.state.failed ? null : this.props.children; }
}
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}
function Unavailable({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(onUnavailable, [onUnavailable]);
  return null;
}
export function DistrictOverviewSurface({ onReady, onUnavailable, ...props }: DistrictOverviewProps & {
  onReady: () => void;
  onUnavailable: () => void;
}) {
  return (
    <OverviewBoundary onUnavailable={onUnavailable}>
      <Canvas orthographic frameloop="demand" dpr={[1, 1.5]}
        camera={{ position: [75, 100, 95], near: 0.1, far: 500 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        fallback={<Unavailable onUnavailable={onUnavailable} />}>
        <color attach="background" args={["#dce7dc"]}/>
        <OverviewModelResources><DistrictOverviewWorld {...props}/></OverviewModelResources>
        <Ready onReady={onReady}/>
      </Canvas>
    </OverviewBoundary>
  );
}
