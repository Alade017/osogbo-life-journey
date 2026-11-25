import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getShowroomModels } from "../src/data/showroom-models.ts";
import { showroomDestinations } from "../src/data/showroom-destinations.ts";

function validateGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 ||
      bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("Invalid GLB 2.0 header or file length");
  }
  let offset = 12;
  let document;
  let binaryLength = 0;
  let seenBinary = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("Truncated chunk header");
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (length % 4 !== 0 || end > bytes.length) throw new Error("Invalid chunk length");
    if (offset === 12 && type !== 0x4e4f534a) throw new Error("First chunk must be JSON");
    if (type === 0x4e4f534a) {
      if (document) throw new Error("Duplicate JSON chunk");
      document = JSON.parse(bytes.toString("utf8", start, end));
    } else if (type === 0x004e4942) {
      if (seenBinary) throw new Error("Duplicate binary chunk");
      seenBinary = true;
      binaryLength = length;
    }
    offset = end;
  }
  if (document?.asset?.version !== "2.0") throw new Error("Missing glTF 2.0 metadata");
  if (!document.meshes?.some(mesh => mesh.primitives?.length)) throw new Error("No mesh primitives");
  if (!document.scenes?.length || !document.nodes?.length) throw new Error("Missing scene or nodes");
  for (const buffer of document.buffers ?? []) {
    if (buffer.uri !== undefined) throw new Error("Buffer must be embedded");
    if (!Number.isSafeInteger(buffer.byteLength) || buffer.byteLength <= 0 || buffer.byteLength > binaryLength) {
      throw new Error("Invalid embedded buffer size");
    }
  }
  if (!seenBinary || !document.buffers?.length) throw new Error("Missing binary buffer");
  for (const view of document.bufferViews ?? []) {
    const start = view.byteOffset ?? 0;
    const buffer = document.buffers[view.buffer];
    if (!buffer || !Number.isSafeInteger(start) || start < 0 ||
        !Number.isSafeInteger(view.byteLength) || view.byteLength <= 0 ||
        start + view.byteLength > buffer.byteLength) throw new Error("Invalid buffer view");
  }
  for (const image of document.images ?? []) {
    if (image.uri !== undefined || !Number.isSafeInteger(image.bufferView) ||
        !document.bufferViews?.[image.bufferView]) throw new Error("Image must use an embedded buffer view");
  }
}

let failures = 0;
let total = 0;
const seen = new Set();
for (const [slug, destination] of Object.entries(showroomDestinations)) {
  console.log("\n" + destination.name);
  for (const model of getShowroomModels(slug)) {
    total++;
    try {
      if (!/^\/models\/showrooms\/[a-z0-9-]+\.glb$/.test(model.url)) throw new Error("Unexpected model path");
      if (seen.has(model.url)) throw new Error("Duplicate model URL");
      seen.add(model.url);
      const path = fileURLToPath(new URL("../public" + model.url, import.meta.url));
      const bytes = await readFile(path);
      validateGlb(bytes);
      console.log("  OK " + model.id + " (" + bytes.length + " bytes)");
    } catch (error) {
      failures++;
      console.error("  FAIL " + model.id + ": " + (error.code === "ENOENT" ? "missing GLB" : error.message));
    }
  }
}
console.log("\n" + (total - failures) + "/" + total + " assets passed basic structural checks.");
console.log("Visual quality, licensing, full glTF conformance and runtime performance require separate review.");
if (failures) process.exitCode = 1;
