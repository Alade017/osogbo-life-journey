import { describe, expect, it } from "vitest";
import { visibleMapMarkers } from "@/components/map/map-marker-layout";

describe("readable map markers", () => {
  it("keeps the selected place when two badges overlap", () => {
    const shown = visibleMapMarkers(
      [
        { id: "a", x: 100, y: 100 },
        { id: "b", x: 110, y: 110, selected: true },
      ],
      390,
      500,
    );
    expect([...shown]).toEqual(["b"]);
  });
  it("reveals crowded destinations when camera zoom separates them", () => {
    const crowded = [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 120, y: 100 },
    ];
    expect(visibleMapMarkers(crowded, 390, 500).size).toBe(1);
    expect(visibleMapMarkers([{ ...crowded[0] }, { ...crowded[1], x: 160 }], 390, 500).size).toBe(
      2,
    );
  });
  it("clips offscreen targets and keeps every visible hit area inside the viewport", () => {
    const shown = visibleMapMarkers(
      [
        { id: "offscreen", x: -100, y: 90 },
        { id: "edge", x: 380, y: 90 },
        { id: "inside", x: 40, y: 90 },
      ],
      390,
      500,
    );
    expect([...shown]).toEqual(["inside"]);
  });
  it("chooses a stable layout independent of marker registration order", () => {
    const markers = [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 110, y: 100 },
      { id: "c", x: 200, y: 100 },
    ];
    expect([...visibleMapMarkers(markers, 390, 500)]).toEqual([
      ...visibleMapMarkers([...markers].reverse(), 390, 500),
    ]);
  });
});
