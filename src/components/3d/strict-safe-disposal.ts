import { useEffect, useRef } from "react";

/**
 * Delay disposal until the current effect has truly stopped using the resource.
 * React Strict Mode replays effect cleanup/setup in development: a new setup
 * cancels the pending disposal for the same object, but never for an old object.
 */
export function useStrictSafeDisposal(resource: { dispose(): void }) {
  const pending = useRef<{
    resource: { dispose(): void };
    cancelled: boolean;
  } | null>(null);

  useEffect(() => {
    if (pending.current?.resource === resource) {
      pending.current.cancelled = true;
      pending.current = null;
    }

    return () => {
      const task = { resource, cancelled: false };
      pending.current = task;
      queueMicrotask(() => {
        if (!task.cancelled) task.resource.dispose();
        if (pending.current === task) pending.current = null;
      });
    };
  }, [resource]);
}
