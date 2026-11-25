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
  it("protects a pending reservation before a clone commits and until both release", () => {
    const registry = createShowroomOwnership();
    const releaseReservation = registry.retain("vehicle.glb");
    expect(registry.canClear("vehicle.glb")).toBe(false);
    const releaseClone = registry.retain("vehicle.glb");
    releaseReservation();
    expect(registry.canClear("vehicle.glb")).toBe(false);
    releaseClone();
    expect(registry.canClear("vehicle.glb")).toBe(true);
  });
  it("releases a failed or abandoned reservation without a committed clone", () => {
    const registry = createShowroomOwnership();
    const release = registry.retain("computer.glb");
    expect(registry.canClear("computer.glb")).toBe(false);
    release();
    expect(registry.canClear("computer.glb")).toBe(true);
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
