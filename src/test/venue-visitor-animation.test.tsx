import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VenueVisitor } from "@/components/3d/VenueVisitor";

const mock = vi.hoisted(() => ({
  invalidate: vi.fn(),
  frame: null as null | ((state: { clock: { elapsedTime: number } }) => void),
}));

vi.mock("@react-three/fiber", () => ({
  useThree: () => ({ invalidate: mock.invalidate }),
  useFrame: (callback: (state: { clock: { elapsedTime: number } }) => void) => {
    mock.frame = callback;
  },
}));

const position = [0, 0.06, 0] as const;
function frame(time = 0.5) {
  if (!mock.frame) throw new Error("VenueVisitor frame callback missing");
  act(() => mock.frame?.({ clock: { elapsedTime: time } }));
}
beforeEach(() => {
  mock.invalidate.mockClear();
  mock.frame = null;
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("VenueVisitor demand rendering", () => {
  it("does not continuously invalidate while stationary", () => {
    render(<VenueVisitor position={position} facing="south" walking={false} />);
    mock.invalidate.mockClear();
    frame();
    frame(0.6);
    expect(mock.invalidate).not.toHaveBeenCalled();
  });
  it("requests another frame while walking", () => {
    render(<VenueVisitor position={position} facing="south" walking />);
    mock.invalidate.mockClear();
    frame();
    expect(mock.invalidate).toHaveBeenCalledTimes(1);
  });
  it("stops requesting frames when walking ends", () => {
    const view = render(<VenueVisitor position={position} facing="south" walking />);
    frame();
    view.rerender(<VenueVisitor position={position} facing="south" walking={false} />);
    mock.invalidate.mockClear();
    frame(0.6);
    expect(mock.invalidate).not.toHaveBeenCalled();
  });
  it("respects reduced-motion preferences", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    render(<VenueVisitor position={position} facing="south" walking />);
    mock.invalidate.mockClear();
    frame();
    expect(mock.invalidate).not.toHaveBeenCalled();
  });
  it("preserves facing rotation values", () => {
    const view = render(<VenueVisitor position={position} facing="north" />);
    const visitor = view.container.querySelector('[name="venue-walkthrough-visitor"]');
    expect(visitor).not.toBeNull();
    expect(visitor?.getAttribute("rotation")).toBe(`0,${Math.PI},0`);
    view.rerender(<VenueVisitor position={position} facing="east" />);
    expect(visitor?.getAttribute("rotation")).toBe(`0,${Math.PI / 2},0`);
  });
  it("does not schedule independent browser animation frames", () => {
    const request = vi.spyOn(window, "requestAnimationFrame");
    try {
      const view = render(<VenueVisitor position={position} facing="south" walking />);
      frame();
      view.unmount();
      expect(request).not.toHaveBeenCalled();
    } finally {
      request.mockRestore();
    }
  });
});
