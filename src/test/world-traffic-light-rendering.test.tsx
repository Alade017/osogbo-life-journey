import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorldTrafficLights } from "@/components/3d/WorldScene";

const frameMock = vi.hoisted(() => ({
  callbacks: [] as Array<() => void>,
  refs: [] as Array<{ current: unknown }>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: (initial: unknown) => {
      const ref = actual.useRef(initial);
      if (!frameMock.refs.includes(ref)) frameMock.refs.push(ref);
      return ref;
    },
  };
});

vi.mock("@react-three/fiber", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@react-three/fiber")>()),
  useFrame: (callback: () => void) => {
    frameMock.callbacks.push(callback);
  },
}));

type MockMaterial = HTMLElement & { color: { set: ReturnType<typeof vi.fn> } };

function mount(initial: "stop" | "caution" | "go" = "stop") {
  let signal: "stop" | "caution" | "go" = initial;
  const getSignalState = vi.fn(() => signal);
  const view = render(
    <WorldTrafficLights
      positions={[[0, 0, "junction-a"]]}
      size={4}
      getSignalState={getSignalState}
    />,
  );
  const materials = Array.from(
    view.container.querySelectorAll("meshbasicmaterial"),
  ) as MockMaterial[];
  expect(materials).toHaveLength(3);
  const setters = materials.map((material) => {
    const set = vi.fn();
    material.color = { set };
    return set;
  });
  expect(frameMock.callbacks).toHaveLength(1);
  const frame = () => act(() => frameMock.callbacks[0]!());
  const materialRefs = materials.map((material) => {
    const ref = frameMock.refs.find((candidate) => candidate.current === material);
    if (!ref) throw new Error("Traffic light material ref missing");
    return ref;
  });
  return {
    frame,
    setters,
    getSignalState,
    setSignal: (next: "stop" | "caution" | "go") => {
      signal = next;
    },
    removeMaterial: (index: number) => {
      materialRefs[index]!.current = null;
    },
    restoreMaterial: (index: number) => {
      materialRefs[index]!.current = materials[index]!;
    },
  };
}

beforeEach(() => {
  frameMock.callbacks = [];
  frameMock.refs = [];
});
afterEach(() => {
  cleanup();
});

describe("WorldTrafficLights material updates", () => {
  it("applies the initial scheduler signal", () => {
    const { frame, setters } = mount("stop");
    frame();
    expect(setters.map((set) => set.mock.lastCall?.[0])).toEqual(["#ef2929", "#49320d", "#173b27"]);
  });

  it("does not rewrite colors for an unchanged signal", () => {
    const { frame, setters, getSignalState } = mount("stop");
    frame();
    frame();
    expect(setters.map((set) => set.mock.calls.length)).toEqual([1, 1, 1]);
    expect(getSignalState).toHaveBeenCalledTimes(2);
  });

  it("updates all lights when stop changes to go", () => {
    const { frame, setters, setSignal } = mount("stop");
    frame();
    setSignal("go");
    frame();
    expect(setters.map((set) => set.mock.lastCall?.[0])).toEqual(["#401b1b", "#49320d", "#22c55e"]);
  });

  it("updates warning colors when go changes to caution", () => {
    const { frame, setters, setSignal } = mount("go");
    frame();
    setSignal("caution");
    frame();
    expect(setters.map((set) => set.mock.lastCall?.[0])).toEqual(["#401b1b", "#f59e0b", "#173b27"]);
  });

  it("does not cache a signal until all materials are mounted", () => {
    const { frame, setters, removeMaterial, restoreMaterial } = mount("stop");
    // Simulate a temporarily unavailable Three.js material ref.
    removeMaterial(1);
    frame();
    expect(setters.map((set) => set.mock.calls.length)).toEqual([0, 0, 0]);
    restoreMaterial(1);
    frame();
    expect(setters.map((set) => set.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it("updates only on actual repeated signal transitions", () => {
    const { frame, setters, setSignal } = mount("stop");
    frame();
    frame();
    setSignal("caution");
    frame();
    frame();
    setSignal("go");
    frame();
    frame();
    expect(setters.map((set) => set.mock.calls.length)).toEqual([3, 3, 3]);
  });
});
