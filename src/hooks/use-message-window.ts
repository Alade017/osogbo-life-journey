import { useLayoutEffect, useRef, useState } from "react";

/** Measure variable-height bubbles; mount only the viewport and a small overscan. */
export function useMessageWindow(ids: string[], enabled: boolean) {
  const ref = useRef<HTMLOListElement>(null);
  const heights = useRef(new Map<string, number>());
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  const [, measure] = useState(0);
  const offsets = [0];
  for (const id of ids)
    offsets.push(offsets[offsets.length - 1]! + (heights.current.get(id) ?? 150));
  const virtual = enabled && ids.length > 40;
  const firstVisible = offsets.findIndex((offset) => offset >= viewport.top);
  const first = virtual ? Math.max(0, (firstVisible < 0 ? ids.length : firstVisible) - 5) : 0;
  let last = first;
  while (last < ids.length && offsets[last]! < viewport.top + viewport.height + 600) last++;
  if (!virtual) last = ids.length;
  const visibleIds = ids.slice(first, last).join(",");
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const update = () => setViewport({ top: list.scrollTop, height: list.clientHeight || 600 });
    list.addEventListener("scroll", update, { passive: true });
    update();
    if (typeof ResizeObserver === "undefined")
      return () => list.removeEventListener("scroll", update);
    const observer = new ResizeObserver((entries) => {
      update();
      let changed = false;
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset["messageId"];
        if (!id) continue;
        const height = entry.target.getBoundingClientRect().height + 8;
        if (heights.current.get(id) !== height) {
          heights.current.set(id, height);
          changed = true;
        }
      }
      if (changed) measure((value) => value + 1);
    });
    observer.observe(list);
    list.querySelectorAll("[data-message-id]").forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, [visibleIds]);
  return {
    ref,
    first,
    last,
    before: offsets[first]!,
    after: offsets[ids.length]! - offsets[last]!,
  };
}
