export type CityLabelRect = { x: number; y: number; width: number; height: number };
export type CityScreenPoint = { x: number; y: number };
export type CityLabelInput = {
  id: string;
  text: string;
  anchor: CityScreenPoint;
  priority?: number;
};
export type CityLabelPlacement = {
  id: string;
  text: string;
  anchor: CityScreenPoint;
  center: CityScreenPoint;
  width: number;
  height: number;
  lines: string[];
};

/** Places every label in screen-space so camera zoom never shrinks its type. */
export function layoutCityLabels(
  labels: readonly CityLabelInput[],
  obstacles: readonly CityLabelRect[],
  bounds: { width: number; height: number },
): CityLabelPlacement[] {
  const occupied = [...obstacles];
  const placements: CityLabelPlacement[] = [];
  const ordered = [...labels].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id),
  );

  for (const label of ordered) {
    const width = Math.min(210, Math.max(78, label.text.length * 5.8 + 18));
    const lines = wrapCityLabel(label.text, Math.max(14, Math.floor((width - 14) / 5.8)));
    const height = Math.max(21, lines.length * 12 + 9);
    const horizontalOffsets = [0, -width * 0.58, width * 0.58, -width * 1.05, width * 1.05];
    const verticalOffsets = [
      38, 58, 78, 98, 118, 138, 158, 178, 198, 218, 238, 258, 278, 298, 318, 338, -34, -54, -74,
      -94, -114, -134,
    ];
    let best: CityScreenPoint | null = null;

    for (const dy of verticalOffsets) {
      for (const dx of horizontalOffsets) {
        const center = {
          x: clamp(label.anchor.x + dx, width / 2 + 4, bounds.width - width / 2 - 4),
          y: clamp(label.anchor.y + dy, height / 2 + 4, bounds.height - height / 2 - 4),
        };
        const candidate = centeredRect(center, width, height);
        if (!occupied.some((rect) => overlaps(candidate, rect))) {
          best = center;
          break;
        }
      }
      if (best) break;
    }

    // Dense maps keep every label: use the first bounded slot even if an obstacle set is full.
    if (!best) {
      best = {
        x: clamp(label.anchor.x, width / 2 + 4, bounds.width - width / 2 - 4),
        y: clamp(label.anchor.y + 358, height / 2 + 4, bounds.height - height / 2 - 4),
      };
    }
    const placement: CityLabelPlacement = {
      id: label.id,
      text: label.text,
      anchor: label.anchor,
      center: best,
      width,
      height,
      lines,
    };
    placements.push(placement);
    occupied.push(centeredRect(best, width, height));
  }
  return placements;
}

export function wrapCityLabel(text: string, maxCharacters: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function centeredRect(center: CityScreenPoint, width: number, height: number): CityLabelRect {
  return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

function overlaps(a: CityLabelRect, b: CityLabelRect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
