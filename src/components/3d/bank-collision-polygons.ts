import { Mesh, Vector3, type Object3D } from "three";
import { BANK_LOBBY, type BankObstaclePolygon } from "@/game/bank-lobby-navigation";

function clipHeight(vertices: readonly Vector3[], height: number, above: boolean) {
  const out: Vector3[] = [];
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j]!,
      b = vertices[i]!;
    const aInside = above ? a.y >= height : a.y <= height,
      bInside = above ? b.y >= height : b.y <= height;
    if (aInside !== bInside) out.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
    if (bInside) out.push(b);
  }
  return out;
}
/** Project only geometry within body height; floors, basements and ceilings do not block routes. */
export function bankCollisionPolygons(roots: readonly Object3D[]): BankObstaclePolygon[] {
  const polygons: BankObstaclePolygon[] = [];
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      const position = part.geometry.getAttribute("position"),
        index = part.geometry.index;
      if (!position) return;
      const count = index?.count ?? position.count;
      for (let i = 0; i + 2 < count; i += 3) {
        a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(part.matrixWorld);
        b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(
          part.matrixWorld,
        );
        c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(
          part.matrixWorld,
        );
        if (Math.max(a.y, b.y, c.y) < 0.12 || Math.min(a.y, b.y, c.y) > BANK_LOBBY.bodyHeight)
          continue;
        const clipped = clipHeight(clipHeight([a, b, c], 0.12, true), BANK_LOBBY.bodyHeight, false);
        if (clipped.length >= 2) polygons.push(clipped.map((p) => [p.x, p.z] as const));
      }
    });
  }
  return polygons;
}
