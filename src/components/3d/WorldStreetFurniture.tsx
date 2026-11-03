import { WorldInstances, type WorldInstance } from "./WorldScene";

export function WorldStreetFurniture({
  items,
}: {
  items: readonly {
    kind: string;
    x: number;
    z: number;
    width: number;
    depth: number;
  }[];
}) {
  const frames: WorldInstance[] = [],
    seats: WorldInstance[] = [],
    panels: WorldInstance[] = [];
  for (const item of items) {
    const { x, z, width, depth, kind } = item;
    if (kind === "streetlight") {
      frames.push(
        { position: [x, 1.6, z], scale: [0.1, 3.2, 0.1] },
        { position: [x + 0.27, 3.15, z], scale: [0.65, 0.1, 0.1] },
      );
      panels.push({ position: [x + 0.52, 3.08, z], scale: [0.35, 0.12, 0.22] });
    } else if (kind === "bench") {
      seats.push(
        { position: [x, 0.52, z], scale: [width, 0.12, depth] },
        { position: [x, 0.85, z - depth * 0.4], scale: [width, 0.55, 0.1] },
      );
      for (const side of [-1, 1])
        frames.push({
          position: [x + side * width * 0.35, 0.25, z],
          scale: [0.1, 0.5, depth * 0.8],
        });
    } else if (kind === "bin") {
      frames.push({ position: [x, 0.36, z], scale: [width, 0.72, depth] });
      seats.push({ position: [x, 0.75, z], scale: [width + 0.07, 0.08, depth + 0.07] });
    } else {
      frames.push({ position: [x, 0.75, z], scale: [0.1, 1.5, 0.1] });
      panels.push({ position: [x, 1.45, z], scale: [Math.max(width, 0.65), 0.55, 0.1] });
    }
  }
  return (
    <>
      <WorldInstances tone="timber" items={frames} />
      <WorldInstances tone="slate" items={seats} />
      <WorldInstances tone="linen" items={panels} />
    </>
  );
}
