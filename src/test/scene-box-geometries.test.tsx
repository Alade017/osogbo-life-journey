import { render, cleanup, waitFor } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { BoxGeometry } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSceneBoxGeometryCache,
  SceneBoxGeometryProvider,
  useSceneBoxGeometry,
} from "@/components/3d/scene-box-geometries";

describe("scene-owned box geometry", () => {
  it("reuses exactly matching dimensions without changing their geometry", () => {
    const cache = createSceneBoxGeometryCache();
    const first = cache.get([1.6, 0.12, 0.85]);
    expect(cache.get([1.6, 0.12, 0.85])).toBe(first);
    expect(first.parameters).toMatchObject({ width: 1.6, height: 0.12, depth: 0.85 });
    const alternate = cache.get([2, 0.12, 0.85]);
    expect(alternate).not.toBe(first);
    expect(alternate.parameters.width).toBe(2);
    cache.dispose();
  });

  it("keeps resources independent between mounted scenes", () => {
    const campus = createSceneBoxGeometryCache();
    const clinic = createSceneBoxGeometryCache();
    const first = campus.get([0.6, 0.12, 0.55]);
    const other = clinic.get([0.6, 0.12, 0.55]);
    const disposeFirst = vi.spyOn(first, "dispose");
    const disposeOther = vi.spyOn(other, "dispose");
    expect(other).not.toBe(first);
    campus.dispose();
    expect(disposeFirst).toHaveBeenCalledTimes(1);
    expect(disposeOther).not.toHaveBeenCalled();
    expect(clinic.get([0.6, 0.12, 0.55])).toBe(other);
    clinic.dispose();
    expect(disposeOther).toHaveBeenCalledTimes(1);
  });

  it("disposes once per distinct geometry and allocates afresh after disposal", () => {
    const cache = createSceneBoxGeometryCache();
    const geometry = cache.get([2, 3, 4]);
    const another = cache.get([3, 2, 4]);
    const firstDispose = vi.spyOn(geometry, "dispose");
    const secondDispose = vi.spyOn(another, "dispose");
    cache.get([2, 3, 4]);
    cache.dispose();
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).toHaveBeenCalledTimes(1);
    const fresh = cache.get([2, 3, 4]);
    expect(fresh).not.toBe(geometry);
    cache.dispose();
  });
});

afterEach(() => {
  cleanup();
});

describe("scene geometry provider lifecycle", () => {
  function Consumer({
    onGeometry,
  }: {
    onGeometry: (geometry: ReturnType<typeof useSceneBoxGeometry>) => void;
  }) {
    const geometry = useSceneBoxGeometry([0.6, 0.12, 0.55]);
    useEffect(() => {
      onGeometry(geometry);
    }, [geometry, onGeometry]);
    return null;
  }

  it("reuses geometry on rerender and disposes it when its scene unmounts", async () => {
    const onGeometry = vi.fn();
    const view = render(
      <SceneBoxGeometryProvider>
        <Consumer onGeometry={onGeometry} />
      </SceneBoxGeometryProvider>,
    );
    const geometry = onGeometry.mock.lastCall![0];
    const dispose = vi.spyOn(geometry, "dispose");
    view.rerender(
      <SceneBoxGeometryProvider>
        <Consumer onGeometry={onGeometry} />
      </SceneBoxGeometryProvider>,
    );
    expect(onGeometry.mock.lastCall![0]).toBe(geometry);
    expect(dispose).not.toHaveBeenCalled();
    view.unmount();
    await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it("keeps sibling scene resources alive when another scene is removed", async () => {
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    const first = render(
      <SceneBoxGeometryProvider>
        <Consumer onGeometry={onFirst} />
      </SceneBoxGeometryProvider>,
    );
    const second = render(
      <SceneBoxGeometryProvider>
        <Consumer onGeometry={onSecond} />
      </SceneBoxGeometryProvider>,
    );
    const firstGeometry = onFirst.mock.lastCall![0];
    const secondGeometry = onSecond.mock.lastCall![0];
    expect(firstGeometry).not.toBe(secondGeometry);
    const disposeFirst = vi.spyOn(firstGeometry, "dispose");
    const disposeSecond = vi.spyOn(secondGeometry, "dispose");
    first.unmount();
    await waitFor(() => expect(disposeFirst).toHaveBeenCalledTimes(1));
    expect(disposeSecond).not.toHaveBeenCalled();
    second.unmount();
    await waitFor(() => expect(disposeSecond).toHaveBeenCalledTimes(1));
  });
  it("does not dispose geometry during the initial Strict Mode effect replay", async () => {
    const dispose = vi.spyOn(BoxGeometry.prototype, "dispose");
    const onGeometry = vi.fn();
    const view = render(
      <StrictMode>
        <SceneBoxGeometryProvider>
          <Consumer onGeometry={onGeometry} />
        </SceneBoxGeometryProvider>
      </StrictMode>,
    );
    try {
      expect(onGeometry).toHaveBeenCalled();
      await Promise.resolve();
      expect(dispose).not.toHaveBeenCalled();
      view.unmount();
      await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    } finally {
      view.unmount();
      dispose.mockRestore();
    }
  });
});
