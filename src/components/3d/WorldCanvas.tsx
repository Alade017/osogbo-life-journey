import { Canvas, type CanvasProps, type Camera } from "@react-three/fiber";
import { OrthographicCamera, PerspectiveCamera } from "three";
import {
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { HostContext } from "./world-scene-context";
import type { WorldSceneRegistry } from "./world-scene-registry";
const emptySnapshot = () => null;

/** Opt in only for audited, props-driven scenes whose providers live above the game host. */
export function WorldCanvas({
  persistent = true,
  ...props
}: Omit<CanvasProps, "camera"> & {
  camera?: Camera;
  persistent?: boolean;
  onSceneError?: (error: Error) => void;
}) {
  const registry = useContext(HostContext);
  if (!registry || !persistent) {
    const { onSceneError: _onSceneError, ...canvasProps } = props;
    return <Canvas {...canvasProps} />;
  }
  return <RegisteredCanvas registry={registry} {...props} />;
}
function RegisteredCanvas({
  registry,
  onSceneError,
  ...props
}: Omit<CanvasProps, "camera"> & {
  camera?: Camera;
  registry: WorldSceneRegistry;
  onSceneError?: ((error: Error) => void) | undefined;
}) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const [registered, setRegistered] = useState(false);
  const isActive = useSyncExternalStore(
    registry.subscribe,
    () => registry.getSnapshot()?.id === id,
    () => false,
  );
  const error = useSyncExternalStore(
    registry.subscribe,
    () => registry.getSource(id)?.error ?? null,
    emptySnapshot,
  );
  const camera = useMemo(() => {
    if (props.camera) return props.camera;
    const next = props.orthographic
      ? new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
      : new PerspectiveCamera(75, 1, 0.1, 1000);
    next.position.z = 5;
    return next;
  }, [props.camera, props.orthographic]);
  useLayoutEffect(() => {
    if (!anchor.current) return;
    registry.register({ id, anchor: anchor.current, props, camera, onError: onSceneError });
  }, [registry, id, props, camera, onSceneError]);
  useLayoutEffect(() => {
    setRegistered(true);
    return () => registry.unregister(id);
  }, [registry, id]);
  return (
    <div
      ref={anchor}
      className={props.className}
      style={{ width: "100%", height: "100%", position: "relative", ...props.style }}
    >
      {error ? (
        <div role="alert">
          <p>The 3D scene could not load.</p>
          <button type="button" onClick={() => registry.retry(id)}>
            Retry scene
          </button>
        </div>
      ) : registered && !isActive ? (
        <Canvas {...props} />
      ) : null}
    </div>
  );
}
