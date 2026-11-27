import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useHouseMovement } from "@/hooks/use-house-movement";

const initial: [number, number, number] = [0, 0.06, 1];

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

it("starts at the default spot when nothing is saved", () => {
  const { result } = renderHook(() => useHouseMovement("house-a", initial));
  expect(result.current.position).toEqual(initial);
});

it("restores the last placed spot for the same house after a remount", () => {
  const first = renderHook(() => useHouseMovement("house-a", initial));
  act(() => first.result.current.place([1.5, 0.06, -2]));
  first.unmount();

  const second = renderHook(() => useHouseMovement("house-a", initial));
  expect(second.result.current.position).toEqual([1.5, 0.06, -2]);
});

it("keeps each house's spot separate", () => {
  const first = renderHook(() => useHouseMovement("house-a", initial));
  act(() => first.result.current.place([1.5, 0.06, -2]));
  first.unmount();

  const other = renderHook(() => useHouseMovement("house-b", initial));
  expect(other.result.current.position).toEqual(initial);
});

it("ignores a corrupted saved value and uses the default spot", () => {
  window.sessionStorage.setItem("osun:house:position:house-a", '["x", 1, 2]');
  const { result } = renderHook(() => useHouseMovement("house-a", initial));
  expect(result.current.position).toEqual(initial);
});
