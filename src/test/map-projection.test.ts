import { describe, expect, it } from "vitest";
import { isoCellToScreen, screenToIsoCell } from "@/lib/map-projection";

describe("map projection", () => {
  it("round-trips isometric grid cells through screen coordinates", () => {
    for (const cell of [
      { col: 0, row: 0 },
      { col: 2.35, row: 6.8 },
      { col: 11, row: 7 },
    ]) {
      const projected = isoCellToScreen(cell, 2);
      const restored = screenToIsoCell(projected, 2);
      expect(restored.col).toBeCloseTo(cell.col, 6);
      expect(restored.row).toBeCloseTo(cell.row, 6);
    }
  });
});
