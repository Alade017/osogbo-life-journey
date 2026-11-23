// @vitest-environment node
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, Raycaster, Vector3 } from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { bankPartMatches, fitBankShell } from "@/components/3d/bank-shell-layout";
import { bankCollisionPolygons } from "@/components/3d/bank-collision-polygons";
import { createBankNavigation } from "@/game/bank-lobby-navigation";

it("aligns the real compressed bank floor, finds sanitized hotspots and routes to the ATM aisle", async () => {
  const bytes = await readFile("public/models/environments/market-and-bank/bank-vault-hall.glb");
  const gltf = await new Promise<GLTF>((resolve, reject) =>
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parse(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        "",
        resolve,
        reject,
      ),
  );
  const sourcePosition = gltf.scene.position.clone();
  const fitted = fitBankShell(gltf.scene);
  expect(fitted.hotspots.map((h) => h.place).sort()).toEqual(["seat", "teller", "teller"]);
  const ray = new Raycaster(new Vector3(0, 10, 3.35), new Vector3(0, -1, 0));
  const floor = ray
    .intersectObject(fitted.holder, true)
    .find((h) => bankPartMatches(h.object.name, "000-lobby-floor-tile"));
  expect(floor).toBeDefined();
  expect(floor!.point.y).toBeCloseTo(0, 2);
  expect(gltf.scene.position).toEqual(sourcePosition);
  expect(gltf.scene.parent).toBeNull();
  const nav = createBankNavigation(bankCollisionPolygons([fitted.holder]));
  const start = nav.nearest([1.5, 3])!;
  expect(nav.route(start, [3, -1])).not.toBeNull();
  expect(nav.canWalk([0, 0])).toBe(false);
});

it("clips obstacles to body height, preserving walls while excluding basement and overhead geometry", () => {
  const root = new Group();
  for (const [x, y] of [
    [0, 1],
    [2, -2],
    [-2, 4],
  ] as const) {
    const mesh = new Mesh(new BoxGeometry(0.5, 1, 0.5));
    mesh.position.set(x, y, 0);
    root.add(mesh);
  }
  const nav = createBankNavigation(bankCollisionPolygons([root]));
  expect(nav.canWalk([0, 0])).toBe(false);
  expect(nav.canWalk([2, 0])).toBe(true);
  expect(nav.canWalk([-2, 0])).toBe(true);
});

it("recognizes only exact bank part names and numeric material suffixes", () => {
  for (const name of ["025-teller-counter", "025-teller-counter/2", "025-teller-counter2"])
    expect(bankPartMatches(name, "025-teller-counter")).toBe(true);
  expect(bankPartMatches("025-teller-counter-decoration", "025-teller-counter")).toBe(false);
});
