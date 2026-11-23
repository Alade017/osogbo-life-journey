import { Box3, Group, Vector3 } from "three";
type Position = [number, number, number];
const LOBBY_WALK = { x: 5.7, z: 3.45 };
const SHELL_HOTSPOTS: Record<string, "teller" | "seat"> = {
  "025-teller-counter": "teller",
  "026-bulletproof-screen": "teller",
  "033-waiting-chairs": "seat",
};

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
      if (part.name === name || part.name.startsWith(name + "/"))
        box.union(new Box3().setFromObject(part));
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

  return { holder, shell, hotspots };
}
