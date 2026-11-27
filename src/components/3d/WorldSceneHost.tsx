import {
  lazy,
  Suspense,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { HostContext } from "./world-scene-context";
import { createWorldSceneRegistry } from "./world-scene-registry";

const Renderer = lazy(() => import("./PersistentWorldRenderer"));
const emptySnapshot = () => null;

export function WorldSceneProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(createWorldSceneRegistry);
  return <HostContext.Provider value={registry}>{children}</HostContext.Provider>;
}

/** Renderer code and WebGL initialization wait until an audited world scene registers. */
export function WorldSceneViewport() {
  const registry = useContext(HostContext);
  if (!registry) return null;
  return <LazyViewport registry={registry} />;
}
function LazyViewport({ registry }: { registry: ReturnType<typeof createWorldSceneRegistry> }) {
  const active = useSyncExternalStore(registry.subscribe, registry.getSnapshot, emptySnapshot);
  const started = useRef(false);
  if (active) started.current = true;
  return started.current ? (
    <Suspense fallback={null}>
      <Renderer registry={registry} />
    </Suspense>
  ) : null;
}
