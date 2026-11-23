import { Canvas, type CanvasProps, type Camera } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import { createPortal } from "react-dom";
import {
  Component,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { WorldSceneRegistry } from "./world-scene-registry";
const emptySnapshot = () => null;

class SceneBoundary extends Component<
  {
    children: ReactNode;
    resetKey: string;
    onError: (error: Error) => void;
  },
  { failed: boolean; resetKey: string }
> {
  override state = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromProps(props: { resetKey: string }, state: { resetKey: string }) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function PersistentWorldRenderer({ registry }: { registry: WorldSceneRegistry }) {
  const active = useSyncExternalStore(registry.subscribe, registry.getSnapshot, emptySnapshot);
  // Retain renderer configuration, not a departed route's DOM, callbacks or scene graph.
  const last = useRef<{ camera: Camera; props: CanvasProps; resetKey: string } | null>(null);
  if (active)
    last.current = {
      camera: active.camera,
      props: {
        ...(active.props.orthographic !== undefined
          ? { orthographic: active.props.orthographic }
          : {}),
        ...(active.props.dpr !== undefined ? { dpr: active.props.dpr } : {}),
        ...(active.props.shadows !== undefined ? { shadows: active.props.shadows } : {}),
        ...(active.props.gl !== undefined ? { gl: active.props.gl } : {}),
      },
      resetKey: `${active.id}:${active.revision}`,
    };
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = document.createElement("div");
    element.className = "persistent-world-renderer";
    Object.assign(element.style, { width: "100%", height: "100%", position: "relative" });
    // R3F skips configuration at zero measured size. Park at a hidden nonzero size
    // so it can clear departed children and apply frameloop="never" during route gaps.
    const parking = document.createElement("div");
    parking.className = "persistent-world-parking";
    parking.setAttribute("aria-hidden", "true");
    parking.setAttribute("inert", "");
    Object.assign(parking.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "1px",
      height: "1px",
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.appendChild(parking);
    registry.connect(element, parking);
    setContainer(element);
    return () => {
      registry.connect(null);
      parking.remove();
    };
  }, [registry]);
  const retained = last.current;
  if (!container || !retained) return null;
  const {
    children,
    style: _style,
    className: _className,
    gl: sourceGL,
    ...props
  } = active?.props ?? retained.props;
  const resetKey = active ? `${active.id}:${active.revision}` : retained.resetKey;
  const onError = (error: Error) => {
    if (active) registry.fail(active.id, error);
  };
  // Context creation options are identical across migrated scenes; runtime exposure is reset.
  const gl = {
    antialias: false,
    powerPreference: "low-power" as const,
    toneMapping: ACESFilmicToneMapping,
    toneMappingExposure: 1,
    ...(typeof sourceGL === "object" ? sourceGL : {}),
  };
  return createPortal(
    <SceneBoundary resetKey={resetKey} onError={onError}>
      <Canvas
        {...props}
        camera={active?.camera ?? retained.camera}
        gl={gl}
        style={{ width: "100%", height: "100%" }}
        frameloop={active && !active.error ? (props.frameloop ?? "demand") : "never"}
      >
        {active && !active.error && (
          <SceneBoundary key={resetKey} resetKey={resetKey} onError={onError}>
            {children}
          </SceneBoundary>
        )}
      </Canvas>
    </SceneBoundary>,
    container,
  );
}
