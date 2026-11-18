import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { HOUSE_STAIR_RISE, type HouseStairs } from "./house-room-contract";

export function createHouseStairModel(stairs: HouseStairs, upperFloor = false) {
  const group = new Group();
  group.name = "duplex-staircase";
  const geometry = new BoxGeometry(1, 1, 1),
    material = new MeshStandardMaterial({ color: "#795736", roughness: 0.8 });
  for (let i = 0; i < 8; i++) {
    const height = ((i + 1) * HOUSE_STAIR_RISE) / 8,
      mesh = new Mesh(geometry, material);
    mesh.scale.set(stairs.x1 - stairs.x0, height, (stairs.z1 - stairs.z0) / 8);
    mesh.position.set(
      (stairs.x0 + stairs.x1) / 2,
      height / 2 - (upperFloor ? HOUSE_STAIR_RISE : 0),
      stairs.z1 - ((stairs.z1 - stairs.z0) * (i + 0.5)) / 8,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (upperFloor)
    for (const x of [stairs.x0, stairs.x1]) {
      const rail = new Mesh(geometry, material);
      rail.scale.set(0.055, 0.75, stairs.z1 - stairs.z0);
      rail.position.set(x, 0.375, (stairs.z0 + stairs.z1) / 2);
      group.add(rail);
    }
  return group;
}
