import { describe, expect, it } from "vitest";
import { selectWorldRenderQuality } from "@/components/3d/render-quality";

describe("selectWorldRenderQuality", () => {
  it.each([
    [{ memoryGB: 4, logicalCores: 8 }, "performance"],
    [{ memoryGB: 8, logicalCores: 4 }, "performance"],
    [{ memoryGB: 8, logicalCores: 8 }, "standard"],
    [{}, "standard"],
    [{ memoryGB: 0, logicalCores: 0 }, "standard"],
  ] as const)("selects quality for %j", (device, expected) => {
    expect(selectWorldRenderQuality(device)).toBe(expected);
  });
});
