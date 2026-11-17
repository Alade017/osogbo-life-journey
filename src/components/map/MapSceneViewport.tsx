import { Component, Suspense, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { WORLD_PALETTE } from "@/components/3d/world-theme";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";

class MapSceneBoundary extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <div className="map-scene-message" role="alert">
        <p>The 3D map could not start. Check that WebGL is enabled and try again.</p>
        <button type="button" onClick={this.props.retry}>
          Retry 3D map
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function MapSceneViewport({ children, label }: { children: ReactNode; label: string }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="map-scene-viewport" aria-label={label}>
      <MapSceneBoundary key={attempt} retry={() => setAttempt((value) => value + 1)}>
        <Suspense
          fallback={
            <WorldLoadingIndicator presentation="screen" title="Loading the map" detail="Preparing the 3D world…" />
          }
        >
          <Canvas
            orthographic
            frameloop="demand"
            dpr={[1, 1.5]}
            shadows
            gl={{ antialias: true, powerPreference: "low-power" }}
            fallback={
              <p className="map-scene-message" role="alert">
                This map requires WebGL support.
              </p>
            }
          >
            <color attach="background" args={[WORLD_PALETTE.sky]} />
            <hemisphereLight args={["#ffffff", WORLD_PALETTE.ground, 2]} />
            <directionalLight
              position={[25, 45, 20]}
              intensity={2}
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-camera-left={-65}
              shadow-camera-right={65}
              shadow-camera-top={65}
              shadow-camera-bottom={-65}
              shadow-normalBias={0.04}
            />
            {children}
          </Canvas>
        </Suspense>
      </MapSceneBoundary>
    </div>
  );
}
