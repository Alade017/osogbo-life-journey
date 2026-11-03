import { useEffect } from "react";

/** Keep the shared dock above the software keyboard without rerendering gameplay. */
export function useGameViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = document.activeElement;
        const editing =
          element instanceof HTMLElement &&
          (element.isContentEditable || element.matches("input, textarea, select"));
        const inset =
          editing && viewport.scale === 1
            ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
            : 0;
        document.documentElement.style.setProperty(
          "--game-keyboard-inset",
          `${Math.round(inset)}px`,
        );
      });
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.documentElement.style.removeProperty("--game-keyboard-inset");
    };
  }, []);
}
