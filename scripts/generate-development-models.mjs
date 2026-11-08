// Original, clearly labelled room fixture; replace it with reviewed Blender exports.
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
for (const folder of ["rooms", "draco"])
  await mkdir(`public/models/${folder}`, { recursive: true });
for (const file of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"])
  await copyFile(
    `node_modules/three/examples/jsm/libs/draco/gltf/${file}`,
    `public/models/draco/${file}`,
  );
const room = new THREE.Group();
room.name = "DevelopmentRoom";
box(room, "Floor", [6, 0.12, 6], [0, -0.06, 0], 0xd8c6a4);
box(room, "BackWall", [6, 2, 0.1], [0, 1, -3], 0xe4decf);
box(room, "SideWall", [0.1, 2, 6], [-3, 1, 0], 0xe4decf);
box(room, "Seat", [1.5, 0.6, 0.65], [-1.5, 0.3, -2.4], 0x176b45);
await exportModel("public/models/rooms/development-room.glb", room);
console.log("Generated the room fixture and copied the local Three.js Draco decoder.");
