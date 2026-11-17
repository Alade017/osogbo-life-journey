import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { useCampusWalkthrough } from "@/hooks/use-campus-walkthrough";
const state = vi.hoisted(() => ({
  point: [0, 0.06, 12],
  finish: null as null | ((done: boolean) => void),
  place: vi.fn(),
}));
vi.mock("@/hooks/use-house-movement", () => ({
  useHouseMovement: () => ({
    get position() {
      return state.point;
    },
    positionRef: {
      get current() {
        return state.point;
      },
    },
    facing: "south",
    walking: false,
    place: (p: number[]) => {
      state.point = p;
      state.place(p);
    },
    walk: () => {
      state.finish?.(false);
      return new Promise<boolean>((resolve) => {
        state.finish = resolve;
      });
    },
    cancel: () => {
      state.finish?.(false);
    },
  }),
}));
beforeEach(() => {
  state.point = [0, 0.06, 12];
  state.finish = null;
  state.place.mockClear();
});
afterEach(cleanup);
it("waits for doorway arrival before entering, then returns to that building when leaving", async () => {
  const { result } = renderHook(() => useCampusWalkthrough("campus"));
  let entering!: Promise<void>;
  act(() => {
    entering = result.current.selectArea("classroom");
  });
  expect(result.current.area).toBe("courtyard");
  expect(result.current.entering).toBe(true);
  expect(state.place).not.toHaveBeenCalled();
  await act(async () => {
    state.finish!(true);
    await entering;
  });
  expect(result.current.area).toBe("classroom");
  expect(state.point).toEqual([0, 0.06, 4]);
  let exiting!: Promise<void>;
  act(() => {
    exiting = result.current.selectArea("courtyard");
  });
  expect(result.current.area).toBe("classroom");
  await act(async () => {
    state.finish!(true);
    await exiting;
  });
  expect(result.current.area).toBe("courtyard");
  expect(state.point[0]).toBe(-9);
});
it("cancels a pending doorway transition when a floor walk takes over", async () => {
  const { result } = renderHook(() => useCampusWalkthrough("campus"));
  let entry!: Promise<void>, walk!: Promise<void>;
  act(() => {
    entry = result.current.selectArea("library");
  });
  act(() => {
    walk = result.current.walkTo([0, 11]);
  });
  await act(async () => {
    await entry;
    state.finish!(true);
    await walk;
  });
  expect(result.current.area).toBe("courtyard");
  expect(state.place).not.toHaveBeenCalled();
  expect(result.current.entering).toBe(false);
});
