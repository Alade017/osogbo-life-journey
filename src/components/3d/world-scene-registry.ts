import type { Camera, CanvasProps } from "@react-three/fiber";

export type WorldSceneSource = {
  id: string;
  anchor: HTMLDivElement;
  props: CanvasProps;
  camera: Camera;
  revision: number;
  error?: Error;
  onError?: ((error: Error) => void) | undefined;
};

/** Owns one movable portal container. Route slots never own or destroy the renderer. */
export function createWorldSceneRegistry() {
  const sources = new Map<string, WorldSceneSource>();
  const listeners = new Set<() => void>();
  let container: HTMLDivElement | null = null;
  let parking: HTMLDivElement | null = null;
  let active: WorldSceneSource | null = null;
  const publish = () => {
    active = sources.values().next().value ?? null;
    if (container) {
      if (active && !active.error) {
        if (container.parentElement !== active.anchor) active.anchor.appendChild(container);
      } else if (parking) {
        if (container.parentElement !== parking) parking.appendChild(container);
      } else container.remove();
    }
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => active,
    getSource: (id: string) => sources.get(id),
    connect(element: HTMLDivElement | null, parkedAt: HTMLDivElement | null = null) {
      container?.remove();
      container = element;
      parking = parkedAt;
      publish();
    },
    register(source: Omit<WorldSceneSource, "revision" | "error">) {
      const previous = sources.get(source.id);
      sources.set(source.id, {
        ...source,
        revision: previous?.revision ?? 0,
        ...(previous?.error ? { error: previous.error } : {}),
      });
      publish();
    },
    unregister(id: string) {
      sources.delete(id);
      publish();
    },
    fail(id: string, error: Error) {
      const source = sources.get(id);
      if (!source) return;
      sources.set(id, { ...source, error });
      publish();
      source.onError?.(error);
    },
    retry(id: string) {
      const source = sources.get(id);
      if (!source) return;
      const { error: _error, ...rest } = source;
      sources.set(id, { ...rest, revision: source.revision + 1 });
      publish();
    },
  };
}
export type WorldSceneRegistry = ReturnType<typeof createWorldSceneRegistry>;
