import { createRoot } from "react-dom/client";

/** Each setup owns a fresh container, including React StrictMode effect replays. */
export function mountSceneOverlay(target: HTMLElement) {
  const element = document.createElement("div");
  element.dataset["sceneOverlay"] = "";
  element.translate = false;
  element.style.cssText =
    "position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:none;";
  const root = createRoot(element);
  target.appendChild(element);
  let disposed = false;
  return {
    element,
    root,
    dispose() {
      if (disposed) return;
      disposed = true;
      // Remove the host wrapper immediately so stale labels disappear without flicker,
      // then defer root.unmount() to a macrotask so React 19 never unmounts a nested
      // root synchronously during an active render or commit pass.
      element.remove();
      globalThis.setTimeout(() => {
        try {
          root.unmount();
        } catch {
          // Ignore teardown errors if the document or container was already destroyed.
        }
      }, 0);
    },
  };
}
