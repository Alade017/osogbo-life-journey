import { createRoot } from "react-dom/client";

/** Each setup owns a fresh container, including React StrictMode effect replays. */
export function mountSceneOverlay(target: HTMLElement) {
  const element = document.createElement("div");
  element.dataset["sceneOverlay"] = "";
  element.translate = false;
  element.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;";
  const root = createRoot(element);
  target.appendChild(element);
  let disposed = false;
  return {
    element,
    root,
    dispose() {
      if (disposed) return;
      disposed = true;
      // Navigation or a blur handler may already have detached or moved the host.
      // Disposing another root during a React commit can race its own DOM removal.
      queueMicrotask(() => {
        root.unmount();
        // remove() never throws, even if a blur handler already moved the node.
       element.remove()
      });
    },
  };
}
