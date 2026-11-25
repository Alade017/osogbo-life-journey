import { describe, expect, it } from "vitest";
import { createShowroomOwnership } from "@/components/3d/showroom-ownership";

describe("showroom ownership", () => {
  it("guards cache clearing until every committed clone releases ownership", () => {
    const registry = createShowroomOwnership();
    const first = registry.retain("vehicle.glb");
    const second = registry.retain("vehicle.glb");
    expect(registry.canClear("vehicle.glb")).toBe(false);
    first();
    first();
    expect(registry.canClear("vehicle.glb")).toBe(false);
    second();
    expect(registry.canClear("vehicle.glb")).toBe(true);
  });
  it("keeps unrelated models independent", () => {
    const registry = createShowroomOwnership();
    const release = registry.retain("vehicle.glb");
    expect(registry.canClear("computer.glb")).toBe(true);
    release();
    const remount = registry.retain("vehicle.glb");
    expect(registry.canClear("vehicle.glb")).toBe(false);
    remount();
    expect(registry.canClear("vehicle.glb")).toBe(true);
  });
});
