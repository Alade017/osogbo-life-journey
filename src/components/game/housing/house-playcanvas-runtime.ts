import * as pc from "playcanvas";
import type { HousePlacement, HouseSlot } from "./HouseRoomScene";
import {
  HOUSE_ACCESSORY_TIER,
  HOUSE_ROOM_SIZE,
  houseSlotPosition,
  type HouseRoomRendererProps,
} from "./house-room-contract";
import {
  createHouseRoomInput,
  type FloorPoint,
  type HouseHit,
  type RoomPointer,
  type RoomPreview,
} from "./house-room-input";

export type RoomLabel = {
  key: string;
  hit: NonNullable<HouseHit>;
  x: number;
  y: number;
  text: string;
};
type Options = {
  signal: AbortSignal;
  labels: (labels: RoomLabel[]) => void;
  fatal: (error: Error) => void;
  /** Only the isolated benchmark fixture overrides this; production uses the house type. */
  roomAssetUrl?: string;
};
export type HomePlayCanvasRuntime = Awaited<ReturnType<typeof createHomePlayCanvas>>;

/** Client-only, display/input adapter. It has no database client or reward logic. */
export async function createHomePlayCanvas(
  canvas: HTMLCanvasElement,
  initial: HouseRoomRendererProps,
  options: Options,
) {
  const device = await pc.createGraphicsDevice(canvas, {
    deviceTypes: [pc.DEVICETYPE_WEBGL2],
    antialias: false,
    powerPreference: "low-power",
  });
  if (options.signal.aborted) {
    device.destroy();
    throw new DOMException("Room was closed", "AbortError");
  }
  let app: pc.Application;
  try {
    app = new pc.Application(canvas, { graphicsDevice: device });
  } catch (error) {
    device.destroy();
    throw error;
  }
  const abort = new AbortController();
  const cleanups: Array<() => void> = [];
  const materials = new Map<string, pc.StandardMaterial>();
  const assets = new Set<pc.Asset>();
  const models = new Map<string, Promise<pc.Asset | null>>();
  const entities = new Map<string, pc.Entity>();
  const slotEntities = new Map<string, pc.Entity>();
  let props = initial;
  let blocked = false;
  let disposed = false;
  let generation = 0;
  let snapshot = "";
  let scene: pc.Entity | undefined;
  let camera: pc.Entity;
  let width = 4.2,
    depth = 3.4,
    distance = 6,
    azimuth = 0.7,
    polar = 0.6;
  let cameraConfigured = false;
  let activePointer: number | null = null;
  let previous: RoomPointer | null = null;
  let frameCount = 0;
  let modelInstanceCount = 0;
  const frameTimes: number[] = [];
  let lastFrame = 0;
  let previewState: RoomPreview = null;
  const dirty = () => {
    if (!disposed && !document.hidden) app.renderNextFrame = true;
  };
  const color = (hex: string) => new pc.Color().fromString(hex);
  const material = (hex: string) => {
    let value = materials.get(hex);
    if (!value) {
      value = new pc.StandardMaterial();
      value.diffuse = color(hex);
      value.useMetalness = true;
      value.metalness = 0;
      value.gloss = 0;
      value.update();
      materials.set(hex, value);
    }
    return value;
  };
  const box = (
    parent: pc.Entity,
    size: [number, number, number],
    position: [number, number, number],
    hex: string,
  ) => {
    const entity = new pc.Entity();
    entity.addComponent("render", { type: "box", material: material(hex), castShadows: false });
    entity.setLocalScale(...size);
    entity.setLocalPosition(...position);
    parent.addChild(entity);
    return entity;
  };
  const restorePlacements = () => {
    for (const item of props.placements) {
      const slot = props.slots.find((candidate) => candidate.id === item.slot);
      if (slot) entities.get(item.id)?.setLocalPosition(...houseSlotPosition(slot, width, depth));
    }
  };
  const showPreview = (value: RoomPreview) => {
    previewState = value;
    restorePlacements();
    if (value)
      entities
        .get(value.placementId)
        ?.setLocalPosition(
          Math.max(-width / 2, Math.min(width / 2, value.point.x)),
          0.2,
          Math.max(-depth / 2, Math.min(depth / 2, value.point.z)),
        );
    const moving = value && props.placements.find((item) => item.id === value.placementId);
    for (const slot of props.slots) {
      const entity = slotEntities.get(slot.id);
      const hex =
        value?.slotId === slot.id
          ? "#44c78b"
          : moving?.slot_type === slot.slot_type
            ? "#59b9dc"
            : "#f6b34c";
      const mesh = entity?.render?.meshInstances[0];
      if (mesh) mesh.material = material(hex);
    }
    dirty();
  };
  const input = createHouseRoomInput(() => ({ props, blocked }), showPreview);
  const releasePointer = () => {
    if (activePointer !== null && canvas.hasPointerCapture?.(activePointer))
      canvas.releasePointerCapture(activePointer);
    activePointer = null;
    previous = null;
  };
  const cancel = () => {
    input.cancel();
    releasePointer();
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    generation++;
    abort.abort();
    cancel();
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    for (const asset of assets) {
      asset.unload();
      app.assets.remove(asset);
    }
    assets.clear();
    models.clear();
    entities.clear();
    slotEntities.clear();
    scene?.destroy();
    for (const value of materials.values()) value.destroy();
    modelInstanceCount = 0;
    materials.clear();
    app.destroy();
  };
  const fail = (error: unknown) => {
    if (disposed) return;
    destroy();
    options.fatal(error instanceof Error ? error : new Error("The room could not start."));
  };
  const listen = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    event: K,
    callback: (event: HTMLElementEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(event, callback, opts);
    cleanups.push(() => target.removeEventListener(event, callback, opts));
  };
  const assetFor = (url: string) => {
    let request = models.get(url);
    if (request) return request;
    request = (async () => {
      try {
        const response = await fetch(url, { method: "HEAD", signal: abort.signal });
        if (!response.ok || disposed) return null;
        return await new Promise<pc.Asset | null>((resolve) => {
          const asset = new pc.Asset(url, "container", { url });
          assets.add(asset);
          asset.once("load", () => {
            if (disposed) {
              asset.unload();
              resolve(null);
            } else resolve(asset);
          });
          asset.once("error", () => resolve(null));
          app.assets.add(asset);
          app.assets.load(asset);
        });
      } catch {
        return null;
      }
    })();
    models.set(url, request);
    return request;
  };
  const model = (
    url: string,
    parent: pc.Entity,
    fallback: pc.Entity,
    token: number,
    tier: number,
  ) => {
    void assetFor(url).then((asset) => {
      if (!asset || disposed || token !== generation) return;
      try {
        const resource = asset.resource as pc.ContainerResource | undefined;
        if (!resource) return;
        const instance = resource.instantiateRenderEntity();
        const visit = (node: pc.GraphNode) => {
          const match = /^Accessory_Tier(\d+)_/.exec(node.name);
          if (match) node.enabled = Number(match[1]) <= tier;
          node.children.forEach(visit);
        };
        visit(instance);
        parent.addChild(instance);
        modelInstanceCount++;
        fallback.enabled = false;
        dirty();
      } catch {
        /* Keep the procedural fallback for an invalid optional model. */
      }
    });
  };
  const furniture = (parent: pc.Entity, item: HousePlacement) => {
    const kind = item.art_key || item.slot_type;
    if (kind === "bed") {
      box(parent, [0.95, 0.18, 1.35], [0, 0.14, 0], "#8a6048");
      box(parent, [0.88, 0.12, 1.22], [0, 0.27, 0], "#e7d9b9");
      box(parent, [0.98, 0.62, 0.1], [0, 0.48, -0.66], "#654838");
      for (const x of [-0.23, 0.23]) box(parent, [0.36, 0.07, 0.25], [x, 0.36, -0.4], "#fffaf0");
    } else if (["sofa", "sofa-2", "seat"].includes(kind)) {
      box(parent, [1.15, 0.34, 0.54], [0, 0.26, 0], "#7b8b70");
      box(parent, [1.15, 0.52, 0.14], [0, 0.54, -0.24], "#65785e");
      for (const x of [-0.54, 0.54]) box(parent, [0.12, 0.44, 0.65], [x, 0.43, 0], "#65785e");
    } else {
      // A placeholder for the benchmark, not a replacement for reviewed furniture artwork.
      box(parent, [0.62, 0.56, 0.52], [0, 0.28, 0], "#aa704b");
    }
  };
  const publishLabels = () => {
    if (disposed || !camera.camera) return;
    options.labels(
      props.editMode
        ? props.slots.flatMap((slot) => {
            const item = props.placements.find((candidate) => candidate.slot === slot.id);
            const position = houseSlotPosition(slot, width, depth);
            const world = new pc.Vec3(position[0], position[1] + 0.46, position[2]);
            if (camera.camera!.viewMatrix.transformPoint(world).z >= 0) return [];
            const screen = camera.camera!.worldToScreen(world);
            return [
              {
                key: slot.id,
                hit: item
                  ? { kind: "placement" as const, id: item.id }
                  : { kind: "slot" as const, id: slot.id },
                x: screen.x,
                y: screen.y,
                text: item?.item_id.replaceAll("-", " ") ?? `Place in ${slot.slot_type} slot`,
              },
            ];
          })
        : [],
    );
  };
  const positionCamera = () => {
    camera.setPosition(
      distance * Math.sin(polar) * Math.sin(azimuth),
      distance * Math.cos(polar),
      distance * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(0, 0, 0);
    publishLabels();
    dirty();
  };
  const resize = () => {
    if (disposed) return;
    const rect = (canvas.parentElement ?? canvas).getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    app.resizeCanvas(rect.width, rect.height);
    publishLabels();
    dirty();
  };
  const rayFor = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (!camera.camera || !rect.width || !rect.height) return null;
    // CameraComponent uses CSS canvas coordinates, independently of device pixel ratio.
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const origin = camera.camera.screenToWorld(x, y, 0.1);
    const end = camera.camera.screenToWorld(x, y, 80);
    return new pc.Ray(origin, end.sub(origin).normalize());
  };
  const floorFor = (event: PointerEvent): FloorPoint | null => {
    const ray = rayFor(event);
    if (!ray || Math.abs(ray.direction.y) < 0.00001) return null;
    const amount = (0.2 - ray.origin.y) / ray.direction.y;
    return amount >= 0
      ? { x: ray.origin.x + ray.direction.x * amount, z: ray.origin.z + ray.direction.z * amount }
      : null;
  };
  const hitFor = (event: PointerEvent): HouseHit => {
    const ray = rayFor(event);
    if (!ray) return null;
    const candidates: Array<{ hit: NonNullable<HouseHit>; distance: number }> = [];
    const consider = (hit: NonNullable<HouseHit>, center: pc.Vec3, half: pc.Vec3) => {
      const point = new pc.Vec3();
      if (new pc.BoundingBox(center, half).intersectsRay(ray, point))
        candidates.push({ hit, distance: point.distance(ray.origin) });
    };
    for (const [id, entity] of entities) {
      const position = entity.getPosition();
      consider(
        { kind: "placement", id },
        new pc.Vec3(position.x, position.y + 0.5, position.z),
        new pc.Vec3(0.6, 0.7, 0.75),
      );
    }
    if (props.editMode)
      for (const [id, entity] of slotEntities)
        consider({ kind: "slot", id }, entity.getPosition().clone(), new pc.Vec3(0.3, 0.1, 0.3));
    return candidates.sort((a, b) => a.distance - b.distance)[0]?.hit ?? null;
  };
  const sample = (event: PointerEvent): RoomPointer => ({
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  });
  const rebuild = () => {
    cancel();
    generation++;
    const token = generation;
    scene?.destroy();
    modelInstanceCount = 0;
    entities.clear();
    slotEntities.clear();
    scene = new pc.Entity("home-room");
    app.root.addChild(scene);
    const size = HOUSE_ROOM_SIZE[props.houseTypeId] ?? HOUSE_ROOM_SIZE["shared-room"]!;
    const roomChanged = width !== size[0] || depth !== size[1];
    [width, depth] = size;
    const room = new pc.Entity("room");
    scene.addChild(room);
    const fallback = new pc.Entity("room-placeholder");
    room.addChild(fallback);
    box(fallback, [width + 0.7, 0.22, depth + 0.7], [0, -0.23, 0], "#58684b");
    box(fallback, [width, 0.16, depth], [0, -0.08, 0], "#d5c8af");
    box(
      fallback,
      [width * 0.44, 0.015, depth * 0.43],
      [-width * 0.26, 0.01, depth * 0.17],
      "#5c4a3f",
    );
    box(
      fallback,
      [width * 0.43, 0.016, depth * 0.43],
      [width * 0.25, 0.015, depth * 0.17],
      "#c7c9be",
    );
    box(fallback, [0.12, 1.32, depth], [-width / 2, 0.66, 0], "#006d59");
    box(fallback, [width, 1.32, 0.12], [0, 0.66, -depth / 2], "#08765f");
    if (width >= 6)
      box(fallback, [0.1, 0.74, depth * 0.55], [width * 0.15, 0.37, -depth * 0.04], "#00806a");
    if (width >= 8)
      box(fallback, [width * 0.28, 0.8, 0.1], [-width * 0.16, 0.4, depth * 0.18], "#00806a");
    const safeType = /^[a-z0-9-]+$/i.test(props.houseTypeId) ? props.houseTypeId : "shared-room";
    model(
      options.roomAssetUrl ?? `/models/rooms/${safeType}.glb`,
      room,
      fallback,
      token,
      HOUSE_ACCESSORY_TIER[props.accessoryBand] ?? 1,
    );
    for (const slot of props.slots) {
      const item = props.placements.find((candidate) => candidate.slot === slot.id);
      const root = new pc.Entity(slot.id);
      root.setPosition(...houseSlotPosition(slot, width, depth));
      scene.addChild(root);
      if (item) {
        entities.set(item.id, root);
        const placeholder = new pc.Entity("furniture-placeholder");
        root.addChild(placeholder);
        furniture(placeholder, item);
        if (/^[a-z0-9-]+$/i.test(item.art_key))
          model(`/models/furniture/${item.art_key}.glb`, root, placeholder, token, 1);
      } else if (props.editMode) {
        const entity = box(root, [0.48, 0.08, 0.48], [0, 0, 0], "#f6b34c");
        slotEntities.set(slot.id, entity);
      }
    }
    if (!cameraConfigured || roomChanged) distance = Math.max(width, depth) * 1.6;
    cameraConfigured = true;
    positionCamera();
  };

  try {
    device.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    app.autoRender = false;
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.scene.ambientLight = color("#bfc8c2");
    camera = new pc.Entity("home-camera");
    camera.addComponent("camera", {
      clearColor: color("#d7e8e5"),
      fov: 42,
      nearClip: 0.1,
      farClip: 80,
    });
    app.root.addChild(camera);
    const light = new pc.Entity("home-light");
    light.addComponent("light", { type: "directional", intensity: 1.5, castShadows: false });
    light.setEulerAngles(45, 30, 0);
    app.root.addChild(light);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement ?? canvas);
    cleanups.push(() => observer.disconnect());
    listen(canvas, "pointerdown", (event) => {
      if (!event.isPrimary) {
        cancel();
        return;
      }
      if (blocked || event.button !== 0 || activePointer !== null) return;
      event.preventDefault();
      activePointer = event.pointerId;
      previous = sample(event);
      canvas.setPointerCapture?.(event.pointerId);
      input.begin(previous, hitFor(event));
    });
    listen(canvas, "pointermove", (event) => {
      if (event.pointerId !== activePointer) return;
      event.preventDefault();
      const next = sample(event);
      if (input.move(next, floorFor(event)) === "orbit" && previous) {
        azimuth -= (next.x - previous.x) * 0.008;
        polar = Math.max(0.35, Math.min(1.3, polar + (next.y - previous.y) * 0.008));
        positionCamera();
      }
      previous = next;
    });
    listen(canvas, "pointerup", (event) => {
      if (event.pointerId !== activePointer) return;
      const overCanvas = document.elementFromPoint(event.clientX, event.clientY) === canvas;
      input.end(sample(event), floorFor(event), hitFor(event), overCanvas);
      releasePointer();
    });
    listen(canvas, "pointercancel", cancel);
    listen(canvas, "lostpointercapture", cancel);
    listen(
      canvas,
      "wheel",
      (event) => {
        if (blocked || activePointer !== null) return;
        event.preventDefault();
        const size = Math.max(width, depth);
        distance = Math.max(
          size * 0.75,
          Math.min(size * 2.5, distance * Math.exp(event.deltaY * 0.001)),
        );
        positionCamera();
      },
      { passive: false },
    );
    const contextLost = (event: Event) => {
      event.preventDefault();
      fail(new Error("The room graphics context was lost."));
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    cleanups.push(() => canvas.removeEventListener("webglcontextlost", contextLost));
    const visibility = () => {
      cancel();
      if (!document.hidden) dirty();
    };
    document.addEventListener("visibilitychange", visibility);
    cleanups.push(() => document.removeEventListener("visibilitychange", visibility));
    const abortListener = () => destroy();
    options.signal.addEventListener("abort", abortListener, { once: true });
    cleanups.push(() => options.signal.removeEventListener("abort", abortListener));
    app.on("frameend", () => {
      const now = performance.now();
      if (lastFrame && !document.hidden) {
        frameTimes.push(now - lastFrame);
        if (frameTimes.length > 600) frameTimes.shift();
      }
      lastFrame = now;
      frameCount++;
    });
    app.on("postrender", publishLabels);
    rebuild();
    resize();
    app.start();
    dirty();
  } catch (error) {
    destroy();
    throw error;
  }
  return {
    update(next: HouseRoomRendererProps, inputBlocked = false) {
      if (disposed) return;
      props = next;
      blocked = inputBlocked;
      if (blocked || !props.editMode || !props.moveEnabled) cancel();
      const key = JSON.stringify([
        props.houseTypeId,
        props.accessoryBand,
        props.slots,
        props.placements,
        props.editMode,
      ]);
      if (key !== snapshot) {
        snapshot = key;
        rebuild();
      }
      publishLabels();
      dirty();
    },
    select(hit: NonNullable<HouseHit>) {
      cancel();
      if (blocked || disposed) return;
      if (hit.kind === "placement") {
        const item = props.placements.find((candidate) => candidate.id === hit.id);
        if (item) props.onSelectPlacement(item);
      } else if (props.editMode) {
        const slot = props.slots.find((candidate) => candidate.id === hit.id);
        if (slot && !props.placements.some((item) => item.slot === slot.id))
          props.onSelectSlot(slot);
      }
    },
    cancel,
    screenPointForSlot(id: string) {
      const slot = props.slots.find((candidate) => candidate.id === id);
      if (!slot || disposed || !camera.camera) return null;
      const point = camera.camera.worldToScreen(
        new pc.Vec3(...houseSlotPosition(slot, width, depth)),
      );
      const rect = canvas.getBoundingClientRect();
      return { x: point.x + rect.left, y: point.y + rect.top };
    },
    metrics() {
      const ordered = [...frameTimes].sort((a, b) => a - b);
      return {
        frameCount,
        p95FrameIntervalMs: ordered[Math.floor(ordered.length * 0.95)] ?? null,
        modelInstanceCount,
        loadedAssets: [...assets].filter((asset) => asset.loaded).length,
        placementCount: entities.size,
        canvasCount: disposed ? 0 : 1,
        dragging: !!previewState,
        disposed,
      };
    },
    destroy,
  };
}
