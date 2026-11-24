import { useEffect, useRef } from "react";

/** Track the actual weather/event strip instead of assuming its mobile height. */
export function useDestinationSceneFrame(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const frame = ref.current;
    const environment = frame.closest(".game-shell")?.querySelector(".world-environment");
    if (!environment) return;
    const measure = () =>
      frame.style.setProperty(
        "--destination-top",
        `${Math.max(0, environment.getBoundingClientRect().bottom)}px`,
      );
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(environment);
    return () => observer?.disconnect();
  }, [active]);
  return ref;
}
