import { renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { BoxGeometry } from "three";
import { describe, expect, it, vi } from "vitest";
import { useWorshipRowGeometry } from "@/components/3d/worship-row-geometry";

describe("worship row geometry ownership", () => {
  it("uses the original prayer-mat and pew dimensions", () => {
    const mat = renderHook(() => useWorshipRowGeometry(true));
    expect(mat.result.current.parameters).toMatchObject({ width: 1.5, height: 0.06, depth: 1.0 });
    const pew = renderHook(() => useWorshipRowGeometry(false));
    expect(pew.result.current.parameters).toMatchObject({ width: 3.6, height: 0.8, depth: 0.7 });
    mat.unmount();
    pew.unmount();
  });

  it("keeps geometry stable across rerenders, and disposes it on unmount", async () => {
    const hook = renderHook(() => useWorshipRowGeometry(true));
    const original = hook.result.current;
    const dispose = vi.spyOn(original, "dispose");
    hook.rerender();
    expect(hook.result.current).toBe(original);
    expect(dispose).not.toHaveBeenCalled();
    hook.unmount();
    await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it("does not dispose another hall's geometry when one hall unmounts", async () => {
    const first = renderHook(() => useWorshipRowGeometry(true));
    const second = renderHook(() => useWorshipRowGeometry(true));
    const firstGeometry = first.result.current;
    const secondGeometry = second.result.current;
    expect(firstGeometry).not.toBe(secondGeometry);
    const firstDispose = vi.spyOn(firstGeometry, "dispose");
    const secondDispose = vi.spyOn(secondGeometry, "dispose");
    first.unmount();
    await waitFor(() => expect(firstDispose).toHaveBeenCalledTimes(1));
    expect(secondDispose).not.toHaveBeenCalled();
    second.unmount();
    await waitFor(() => expect(secondDispose).toHaveBeenCalledTimes(1));
  });

  it("releases the old geometry after the row type changes", async () => {
    const hook = renderHook(({ isMosque }) => useWorshipRowGeometry(isMosque), {
      initialProps: { isMosque: true },
    });
    const former = hook.result.current;
    const dispose = vi.spyOn(former, "dispose");
    hook.rerender({ isMosque: false });
    expect(hook.result.current).not.toBe(former);
    await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    hook.unmount();
  });

  it("allocates fresh geometry after a hall is unmounted and remounted", () => {
    const first = renderHook(() => useWorshipRowGeometry(false));
    const original = first.result.current;
    first.unmount();
    const next = renderHook(() => useWorshipRowGeometry(false));
    expect(next.result.current).not.toBe(original);
    next.unmount();
  });
  it("does not dispose worship geometry during the initial Strict Mode effect replay", async () => {
    const dispose = vi.spyOn(BoxGeometry.prototype, "dispose");
    const hook = renderHook(() => useWorshipRowGeometry(true), { wrapper: StrictMode });
    try {
      expect(hook.result.current).toBeDefined();
      await Promise.resolve();
      expect(dispose).not.toHaveBeenCalled();
      hook.unmount();
      await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    } finally {
      hook.unmount();
      dispose.mockRestore();
    }
  });
});
