import { useFrame } from "@react-three/fiber";

const gap = 4;

/** Pack projected labels in screen space after SceneHtml positions their containers. */
export function OverviewLabelLayout() {
  useFrame(({ gl }) => {
    const viewport = gl.domElement.getBoundingClientRect();
    const labels = Array.from(
      gl.domElement.parentElement?.querySelectorAll<HTMLElement>("[data-atlas-label]") ?? [],
      (element) => ({
        element,
        bounds: element.getBoundingClientRect(),
        priority: Number(element.dataset["atlasLabel"]),
      }),
    ).sort((a, b) => b.priority - a.priority);
    const visible: DOMRect[] = [];
    for (const { element, bounds: rect } of labels) {
      const fits =
        rect.width > 0 &&
        rect.left >= viewport.left + gap &&
        rect.right <= viewport.right - gap &&
        rect.top >= viewport.top + gap &&
        rect.bottom <= viewport.bottom - gap;
      const overlaps = visible.some(
        (other) =>
          rect.left < other.right + gap &&
          rect.right > other.left - gap &&
          rect.top < other.bottom + gap &&
          rect.bottom > other.top - gap,
      );
      const visibility = fits && !overlaps ? "visible" : "hidden";
      if (visibility === "visible") visible.push(rect);
      if (element.style.visibility !== visibility) element.style.visibility = visibility;
    }
  });
  return null;
}
