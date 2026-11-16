export type ProjectedMapMarker = { id: string; x: number; y: number; selected?: boolean };

/** Selected destinations take priority; crowded badges reappear when zoom separates them. */
export function visibleMapMarkers(
  markers: readonly ProjectedMapMarker[],
  width: number,
  height: number,
  gap = 48,
) {
  const visible = new Set<string>();
  const placed: ProjectedMapMarker[] = [];
  const radius = 22;
  const ordered = [...markers].sort(
    (a, b) => Number(Boolean(b.selected)) - Number(Boolean(a.selected)) || a.id.localeCompare(b.id),
  );
  for (const marker of ordered) {
    if (
      marker.x < radius ||
      marker.x > width - radius ||
      marker.y < radius ||
      marker.y > height - radius
    )
      continue;
    if (placed.some((other) => Math.hypot(other.x - marker.x, other.y - marker.y) < gap)) continue;
    visible.add(marker.id);
    placed.push(marker);
  }
  return visible;
}
