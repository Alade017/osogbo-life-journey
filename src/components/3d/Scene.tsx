import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { Camera } from "./Camera";
import { Lights } from "./Lights";
import { DRACO_PATH } from "@/types/models";

class SceneError extends Component<
  { children: ReactNode; onError?: (error: Error) => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }
  override render() {
    return this.state.failed ? (
      <p role="alert">The 3D scene could not load. Reconnect to retry.</p>
    ) : (
      this.props.children
    );
  }
}
export function preloadModels(paths: readonly string[]) {
  paths.forEach((path) => useGLTF.preload(path, DRACO_PATH));
}
export function Scene({
  children,
  zoom,
  animated = false,
  onError,
}: {
  children: ReactNode;
  zoom?: number;
  animated?: boolean;
  onError?: (error: Error) => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return (
    <SceneError {...(onError ? { onError } : {})}>
      <Canvas
        orthographic
        shadows={false}
        dpr={[1, 1.25]}
        frameloop={visible ? (animated ? "always" : "demand") : "never"}
        fallback={<p role="alert">3D requires WebGL. Your browser could not start it.</p>}
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#e8eedf"]} />
        <Camera zoom={zoom ?? 38} />
        <Lights />
        <Suspense
          fallback={
            <Html center>
              <p role="status">Loading 3D assets…</p>
            </Html>
          }
        >
          {children}
        </Suspense>
      </Canvas>
    </SceneError>
  );
}
