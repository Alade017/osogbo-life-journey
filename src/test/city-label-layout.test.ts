import { describe, expect, it } from "vitest";
import { layoutCityLabels, wrapCityLabel } from "@/lib/city-label-layout";

describe("city label layout", () => {
  it("keeps labels at screen-space size and avoids panels and other labels", () => {
    const labels = layoutCityLabels(
      [
        { id: "market", text: "Oja Oba Market", anchor: { x: 200, y: 180 }, priority: 2 },
        { id: "garage", text: "Old Garage Motor Park", anchor: { x: 205, y: 182 }, priority: 1 },
      ],
      [{ x: 170, y: 145, width: 100, height: 80 }],
      { width: 1000, height: 760 },
    );

    expect(labels).toHaveLength(2);
    expect(labels[0]?.width).toBeGreaterThanOrEqual(78);
    expect(labels[0]?.center).not.toEqual(labels[1]?.center);
    for (const label of labels) {
      const box = {
        x: label.center.x - label.width / 2,
        y: label.center.y - label.height / 2,
        width: label.width,
        height: label.height,
      };
      expect(
        box.x + box.width <= 170 || box.x >= 270 || box.y + box.height <= 145 || box.y >= 225,
      ).toBe(true);
    }
  });

  it("wraps complete location names without truncating them", () => {
    expect(wrapCityLabel("Oja Oba Community Market", 12)).toEqual([
      "Oja Oba",
      "Community",
      "Market",
    ]);
  });
});
