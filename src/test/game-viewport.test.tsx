import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGameViewport } from "@/hooks/use-game-viewport";

const originalViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalViewport) Object.defineProperty(window, "visualViewport", originalViewport);
  else Reflect.deleteProperty(window, "visualViewport");
});

it("tracks keyboard space without treating pinch zoom as a keyboard and cleans up", () => {
  const viewport = Object.assign(new EventTarget(), {
    height: window.innerHeight - 300,
    offsetTop: 0,
    scale: 1,
  });
  Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  function Probe() {
    useGameViewport();
    return <input aria-label="Message" />;
  }
  const view = render(<Probe />);
  expect(document.documentElement.style.getPropertyValue("--game-keyboard-inset")).toBe("0px");
  act(() => view.getByRole("textbox").focus());
  expect(document.documentElement.style.getPropertyValue("--game-keyboard-inset")).toBe("300px");
  viewport.scale = 2;
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(document.documentElement.style.getPropertyValue("--game-keyboard-inset")).toBe("0px");
  view.unmount();
  viewport.scale = 1;
  viewport.dispatchEvent(new Event("resize"));
  expect(document.documentElement.style.getPropertyValue("--game-keyboard-inset")).toBe("");
});
