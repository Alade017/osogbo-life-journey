import { describe, expect, it, vi } from "vitest";
import { createSceneBoxGeometryCache } from "@/components/3d/scene-box-geometries";

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
