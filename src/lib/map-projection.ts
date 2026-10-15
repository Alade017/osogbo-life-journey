import { cityWorldToIso, type CityWorldPosition } from "@/lib/city-world";
import mapData from "@/data/osogbo-map.json";

export type IsoCell = { col: number; row: number };
export type MapPoint = { x: number; y: number };
export type MapProjectionMode = "2d" | "isometric";

const districts = mapData.districts as unknown as {
  id: string;
  shape: [number, number][];
  isoCells: IsoCell[];
}[];
const SCALE = 1.5;

export function isoCellToScreen(cell: IsoCell, height = 0): MapPoint {
  const point = cityWorldToIso({ x: cell.col, y: cell.row }, height * 8);
  return {
    x: (point.x - 500) * SCALE + 600,
    y: (point.y - 58) * SCALE + 100,
  };
}

export function screenToIsoCell(point: MapPoint, height = 0): IsoCell {
  const worldX = (point.x - 600) / SCALE + 500;
  const worldY = (point.y - 100) / SCALE + 58 + height * 8;
  const difference = (worldX - 500) / 31;
  const sum = (worldY - 58) / 20;
  return { col: (sum + difference) / 2, row: (sum - difference) / 2 };
}

export function mapPointToIsoCell(point: MapPoint): IsoCell {
  const district =
    districts.find((item) => pointInPolygon(point, item.shape)) ??
    districts.reduce((best, item) =>
      distanceToBounds(point, item.shape) < distanceToBounds(point, best.shape) ? item : best,
    );
  const xs = district.shape.map(([x]) => x);
  const ys = district.shape.map(([, y]) => y);
  const cells = district.isoCells;
  const minCol = Math.min(...cells.map(({ col }) => col));
  const maxCol = Math.max(...cells.map(({ col }) => col));
  const minRow = Math.min(...cells.map(({ row }) => row));
  const maxRow = Math.max(...cells.map(({ row }) => row));
  return {
    col:
      minCol +
      ((point.x - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs))) * (maxCol - minCol),
    row:
      minRow +
      ((point.y - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys))) * (maxRow - minRow),
  };
}

export function isoCellTo2dViewBox(cell: IsoCell, districtId: string): MapPoint {
  const district = districts.find(({ id }) => id === districtId);
  if (!district) return { x: 600, y: 400 };
  const xs = district.shape.map(([x]) => x);
  const ys = district.shape.map(([, y]) => y);
  const cells = district.isoCells;
  const minCol = Math.min(...cells.map(({ col }) => col));
  const maxCol = Math.max(...cells.map(({ col }) => col));
  const minRow = Math.min(...cells.map(({ row }) => row));
  const maxRow = Math.max(...cells.map(({ row }) => row));
  return {
    x:
      Math.min(...xs) +
      ((cell.col - minCol) / Math.max(maxCol - minCol, 0.001)) *
        (Math.max(...xs) - Math.min(...xs)),
    y:
      Math.min(...ys) +
      ((cell.row - minRow) / Math.max(maxRow - minRow, 0.001)) *
        (Math.max(...ys) - Math.min(...ys)),
  };
}

export function mapPointForMode(point: MapPoint, mode: MapProjectionMode): MapPoint {
  return mode === "2d" ? point : isoCellToScreen(mapPointToIsoCell(point));
}

function pointInPolygon(point: MapPoint, polygon: [number, number][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function distanceToBounds(point: MapPoint, shape: [number, number][]) {
  const xs = shape.map(([x]) => x),
    ys = shape.map(([, y]) => y);
  const dx = Math.max(Math.min(...xs) - point.x, 0, point.x - Math.max(...xs));
  const dy = Math.max(Math.min(...ys) - point.y, 0, point.y - Math.max(...ys));
  return Math.hypot(dx, dy);
}

export function isoCellToWorld(cell: IsoCell): CityWorldPosition {
  return { x: cell.col, y: cell.row };
}
