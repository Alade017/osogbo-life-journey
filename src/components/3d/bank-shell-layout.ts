import { BANK_LOBBY } from "@/game/bank-lobby-navigation";
import { Box3, Group, Mesh, Vector3 } from "three";
type Position = [number, number, number];
const LOBBY_WALK = { x: BANK_LOBBY.halfWidth, z: BANK_LOBBY.halfDepth };
const SHELL_HOTSPOTS: Record<string, "teller" | "seat"> = {
  "025-teller-counter": "teller",
  "026-bulletproof-screen": "teller",
  "033-waiting-chairs": "seat",
};

/** GLTFLoader sanitizes slash-separated material suffixes (counter/0 -> counter0). */
export function bankPartMatches(name: string, prefix: string) {
  return name === prefix || (/^\/?\d+$/.test(name.slice(prefix.length)) && name.startsWith(prefix));
}

function dominantFloorHeight(holder: Group) {
  const levels = new Map<number, { area: number; height: number }>();
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  holder.traverse((part) => {
    if (!(part instanceof Mesh) || !bankPartMatches(part.name, "000-lobby-floor-tile")) return;
    const positions = part.geometry.getAttribute("position"),
      index = part.geometry.index;
    if (!positions) return;
    for (let i = 0; i + 2 < (index?.count ?? positions.count); i += 3) {
      a.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(part.matrixWorld);
      b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1).applyMatrix4(
        part.matrixWorld,
      );
      c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2).applyMatrix4(
        part.matrixWorld,
      );
      if (Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y) > 0.01) continue;
      const area = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
      if (area < 0.00001) continue;
      const y = (a.y + b.y + c.y) / 3,
        key = Math.round(y / 0.01),
        old = levels.get(key) ?? { area: 0, height: 0 };
      levels.set(key, { area: old.area + area, height: old.height + y * area });
    }
  });
  const best = [...levels.values()].sort(
    (a, b) => b.area - a.area || b.height / b.area - a.height / a.area,
  )[0];
  if (!best) throw new Error("The bank model has no identifiable lobby floor.");
  return best.height / best.area;
}

type ShellHotspot = { place: "teller" | "seat"; centre: Position; size: Position };

/**
 * Turns the shell so its long side runs across the lobby, scales it to fit the walkable floor,
 * and reads each hotspot's bounds from the model's own named parts.
 */
export function fitBankShell(scene: Group) {
  const shell = scene.clone(true);
  const holder = new Group();
  holder.add(shell);
  holder.updateMatrixWorld(true);

  const hotspots: ShellHotspot[] = [];
  for (const [name, place] of Object.entries(SHELL_HOTSPOTS)) {
    const box = new Box3();
    shell.traverse((part) => {
      if (bankPartMatches(part.name, name)) box.union(new Box3().setFromObject(part));
    });
    if (box.isEmpty()) continue;
    const centre = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    hotspots.push({
      place,
      centre: [centre.x, centre.y, centre.z],
      size: [size.x, size.y, size.z],
    });
  }

  // Turn a quarter, then scale so the rotated footprint fits the walkable floor.
  holder.rotation.y = Math.PI / 2;
  holder.updateMatrixWorld(true);
  const turned = new Box3().setFromObject(holder);
  const turnedSize = turned.getSize(new Vector3());
  if (![turnedSize.x, turnedSize.z].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("The bank model has no usable floor bounds.");
  }
  const fit = Math.min((LOBBY_WALK.x * 2) / turnedSize.x, (LOBBY_WALK.z * 2) / turnedSize.z);
  holder.scale.setScalar(fit);
  holder.updateMatrixWorld(true);
  const placed = new Box3().setFromObject(holder);
  const centre = placed.getCenter(new Vector3());
  // Centre the hall on the origin, with its floor at y = 0.
  holder.position.set(-centre.x, -placed.min.y, -centre.z);

  holder.updateMatrixWorld(true);
  const floorOffset = dominantFloorHeight(holder);
  holder.position.y -= floorOffset;
  holder.updateMatrixWorld(true);
  return { holder, shell, hotspots, floorOffset };
}
