// Original, clearly labelled fixtures; replace these with reviewed Blender exports.
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
class NodeFileReader {
  result;
  onloadend;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader = NodeFileReader;
function box(parent, name, size, position, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
async function exportModel(path, scene, animations = []) {
  const buffer = await new GLTFExporter().parseAsync(scene, { binary: true, animations });
  await writeFile(path, Buffer.from(buffer));
}
for (const folder of ["characters", "city", "rooms", "draco"])
  await mkdir(`public/models/${folder}`, { recursive: true });
for (const file of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"])
  await copyFile(
    `node_modules/three/examples/jsm/libs/draco/gltf/${file}`,
    `public/models/draco/${file}`,
  );
const character = new THREE.Group();
character.name = "Character";
const body = new THREE.Group();
body.name = "CharacterBody";
character.add(body);
function characterPart(parent, name, size, position, materialName, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ name: materialName, color, roughness: 1 }),
  );
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
function rotationTrack(name, times, angles, axis = "x") {
  const values = angles.flatMap((angle) => {
    const euler = new THREE.Euler(
      axis === "x" ? angle : 0,
      axis === "y" ? angle : 0,
      axis === "z" ? angle : 0,
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    return quaternion.toArray();
  });
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
}
characterPart(body, "Torso", [0.45, 0.6, 0.25], [0, 0.9, 0], "Outfit", 0x176b45);
const head = new THREE.Group();
head.name = "Head";
head.position.y = 1.4;
body.add(head);
characterPart(head, "HeadMesh", [0.32, 0.34, 0.3], [0, 0, 0], "Skin", 0x775038);
for (const [name, x] of [
  ["LeftLeg", -0.12],
  ["RightLeg", 0.12],
]) {
  const leg = new THREE.Group();
  leg.name = name;
  leg.position.set(x, 0.6, 0);
  body.add(leg);
  characterPart(leg, `${name}Mesh`, [0.17, 0.6, 0.2], [0, -0.3, 0], "Outfit", 0x202820);
}
for (const [name, x] of [
  ["LeftArm", -0.31],
  ["RightArm", 0.31],
]) {
  const arm = new THREE.Group();
  arm.name = name;
  arm.position.set(x, 1.2, 0);
  body.add(arm);
  characterPart(arm, `${name}Mesh`, [0.14, 0.55, 0.2], [0, -0.27, 0], "Skin", 0x775038);
}
const idle = new THREE.AnimationClip("Idle", 2, [
  new THREE.NumberKeyframeTrack("CharacterBody.position[y]", [0, 1, 2], [0, 0.01, 0]),
]);
const walk = new THREE.AnimationClip("Walk", 0.6, [
  new THREE.NumberKeyframeTrack(
    "CharacterBody.position[y]",
    [0, 0.15, 0.3, 0.45, 0.6],
    [0, 0.04, 0, 0.04, 0],
  ),
]);
const sit = new THREE.AnimationClip("Sit", 1.2, [
  rotationTrack("CharacterBody", [0, 0.6, 1.2], [0, 0.35, 0.35]),
  rotationTrack("LeftLeg", [0, 0.6, 1.2], [0, -0.7, -0.7]),
  rotationTrack("RightLeg", [0, 0.6, 1.2], [0, -0.7, -0.7]),
]);
const work = new THREE.AnimationClip("Work", 0.8, [
  rotationTrack("RightArm", [0, 0.2, 0.4, 0.6, 0.8], [0, -0.7, 0, -0.7, 0]),
  new THREE.NumberKeyframeTrack("CharacterBody.position[y]", [0, 0.4, 0.8], [0, -0.025, 0]),
]);
const wave = new THREE.AnimationClip("Wave", 1, [
  rotationTrack("RightArm", [0, 0.25, 0.5, 0.75, 1], [0, -1.2, -0.55, -1.2, 0], "z"),
]);
await exportModel("public/models/characters/development-character.glb", character, [
  idle,
  walk,
  sit,
  work,
  wave,
]);
const city = new THREE.Group();
city.name = "DevelopmentCity";
box(city, "Ground", [18, 0.12, 16], [0, -0.07, 0], 0xe8eedf);
box(city, "MainRoad", [2, 0.02, 16], [0, 0, 0], 0x89938e);
box(city, "CrossRoad", [18, 0.025, 2], [0, 0, 0], 0x89938e);
await exportModel("public/models/city/development-city.glb", city);
const building = new THREE.Group();
building.name = "DevelopmentBuilding";
// Footprint: 114×58 server scene pixels at 40 pixels per 3D unit.
box(building, "Walls", [2.85, 1.7, 1.45], [0, 0.85, 0], 0xd9c4a1);
box(building, "Roof", [2.85, 0.18, 1.45], [0, 1.8, 0], 0x176b45);
box(building, "Door", [0.45, 0.9, 0.025], [0, 0.45, 0.73], 0x5c3927);
await exportModel("public/models/city/development-building.glb", building);
const room = new THREE.Group();
room.name = "DevelopmentRoom";
box(room, "Floor", [6, 0.12, 6], [0, -0.06, 0], 0xd8c6a4);
box(room, "BackWall", [6, 2, 0.1], [0, 1, -3], 0xe4decf);
box(room, "SideWall", [0.1, 2, 6], [-3, 1, 0], 0xe4decf);
box(room, "Seat", [1.5, 0.6, 0.65], [-1.5, 0.3, -2.4], 0x176b45);
await exportModel("public/models/rooms/development-room.glb", room);
console.log("Generated original development GLBs and copied the local Three.js Draco decoder.");
