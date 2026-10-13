import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import type { OrbitControls } from "three-stdlib";
import { Scene, preloadModels } from "@/components/3d/Scene";
import { Character } from "@/components/3d/Character";
import { CityMap, RepeatedProps } from "@/components/3d/CityMap";
import { Room } from "@/components/3d/Room";
import {
  DEVELOPMENT_MODELS,
  type CharacterAnimationState,
  type CityLocationModel,
  type Vector3Tuple,
} from "@/types/models";
import { nearestInteraction, toScene, toWorld, type WorldPoint } from "./neighborhood-model";
import { characterAppearance3D } from "./character-3d-appearance";
import { parseSavedAppearance } from "./character-animation";
import type { NeighborhoodBridge, MovementInput } from "./neighborhood-scene";
import type { NetworkPlayerSnapshot } from "./multiplayer-state";

type Snapshot = NetworkPlayerSnapshot & { sessionId: string };
export const sceneTo3D = (point: WorldPoint): Vector3Tuple => [
  (point.x - 320) / 40,
  0,
  (point.y - 300) / 40,
];
const keyDirections: Record<string, MovementInput> = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
};

export class ThreeNeighborhoodController {
  players = new Map<string, Snapshot>();
  localSessionId: string | null = null;
  point: WorldPoint;
  ready = false;
  frozen = true;
  zoomValue = 38;
  version = 0;
  private listeners = new Set<() => void>();
  private input = new Set<string>();
  private destination: WorldPoint | null = null;
  private lastNearby: string | null = null;
  private wasMoving = false;
  localAnimation: CharacterAnimationState | null = null;
  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(public bridge: NeighborhoodBridge) {
    this.point = { ...bridge.spawn };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.version;
  notify() {
    this.version++;
    this.listeners.forEach((listener) => listener());
  }
  lock(value: boolean) {
    this.frozen = value;
    if (value) {
      this.input.clear();
      this.destination = null;
      this.bridge.onMovementIntent({ x: 0, y: 0 });
    }
  }
  restore(point: WorldPoint) {
    this.point = { ...point };
  }
  setTouch(direction: MovementInput, pressed: boolean) {
    if (pressed) this.input.add(direction);
    else this.input.delete(direction);
  }
  setLocalSessionId(id: string | null) {
    this.localSessionId = id;
    this.notify();
  }
  syncNetworkPlayers(players: Snapshot[]) {
    const changed =
      players.length !== this.players.size ||
      players.some((player) => !this.players.has(player.sessionId));
    const ids = new Set(players.map((player) => player.sessionId));
    for (const id of this.players.keys()) if (!ids.has(id)) this.players.delete(id);
    for (const player of players) {
      this.players.set(player.sessionId, player);
      if (player.sessionId === this.localSessionId) this.point = { x: player.x, y: player.y };
    }
    if (changed) this.notify();
  }
  zoom(change: number) {
    this.zoomValue = Math.max(18, Math.min(80, this.zoomValue + change * 20));
    this.notify();
  }
  setAnimation(animation: CharacterAnimationState | null) {
    this.localAnimation = animation;
    if (this.animationTimer) clearTimeout(this.animationTimer);
    this.animationTimer = null;
    this.notify();
  }
  playAvatarAction(animation: CharacterAnimationState = "wave", durationMs = 1200) {
    this.setAnimation(animation);
    this.animationTimer = setTimeout(
      () => {
        this.localAnimation = null;
        this.animationTimer = null;
        this.notify();
      },
      Math.max(0, durationMs),
    );
  }
  checkpoint() {
    return this.bridge.saveCheckpoint(this.point);
  }
  interact() {
    const object = nearestInteraction(
      toScene(this.point, this.bridge.origin),
      this.bridge.area?.objects,
    );
    if (object && !this.frozen) this.bridge.onInteract(object);
  }
  selectLocation(id: string) {
    const object = this.bridge.area?.objects.find((entry) => entry.id === id);
    if (!object || this.frozen) return;
    const nearby = nearestInteraction(toScene(this.point, this.bridge.origin), [object]);
    if (nearby) this.bridge.onInteract(object);
    else this.destination = toWorld({ x: object.x, y: object.y + 20 }, this.bridge.origin);
  }
  selectPlayer(player: Snapshot) {
    if (this.frozen) return;
    if (Math.hypot(player.x - this.point.x, player.y - this.point.y) <= 65 / 160)
      this.bridge.onPlayerSelected(player);
    else this.bridge.onPlayerTooFar(player.name);
  }
  tick() {
    if (!this.ready || this.frozen) return;
    let x = Number(this.input.has("right")) - Number(this.input.has("left"));
    let y = Number(this.input.has("down")) - Number(this.input.has("up"));
    if (!x && !y && this.destination) {
      const dx = this.destination.x - this.point.x,
        dy = this.destination.y - this.point.y;
      if (Math.hypot(dx, dy) < 0.07) this.destination = null;
      else {
        x = Math.abs(dx) > 0.04 ? Math.sign(dx) : 0;
        y = Math.abs(dy) > 0.04 ? Math.sign(dy) : 0;
      }
    }
    const moving = !!(x || y);
    this.bridge.onMovementIntent({ x, y });
    if (this.wasMoving && !moving) this.bridge.onCheckpoint(this.point);
    this.wasMoving = moving;
    const nearby = nearestInteraction(
      toScene(this.point, this.bridge.origin),
      this.bridge.area?.objects,
    );
    if ((nearby?.id ?? null) !== this.lastNearby) {
      this.lastNearby = nearby?.id ?? null;
      this.bridge.onNearby(nearby);
    }
  }
  bind() {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      const direction = keyDirections[event.key];
      if (direction && !this.frozen) {
        event.preventDefault();
        this.setTouch(direction, true);
      }
      if (event.key.toLowerCase() === "e") this.interact();
    };
    const up = (event: KeyboardEvent) => {
      const direction = keyDirections[event.key];
      if (direction) this.setTouch(direction, false);
    };
    const stop = () => {
      this.input.clear();
      this.destination = null;
      this.bridge.onMovementIntent({ x: 0, y: 0 });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    const timer = setInterval(() => this.tick(), 100);
    return () => {
      clearInterval(timer);
      if (this.animationTimer) clearTimeout(this.animationTimer);
      this.animationTimer = null;
      stop();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
    };
  }
}

function NetworkActor({ id, controller }: { id: string; controller: ThreeNeighborhoodController }) {
  const root = useRef<Group>(null);
  const [animation, setAnimation] = useState("Idle");
  const last = useRef<WorldPoint | null>(null);
  const movedAt = useRef(-Infinity);
  useFrame((state, delta) => {
    const player = controller.players.get(id);
    if (!player || !root.current) return;
    const point = sceneTo3D(toScene(player, controller.bridge.origin));
    const distance = last.current
      ? Math.hypot(player.x - last.current.x, player.y - last.current.y)
      : 0;
    if (distance > 0.0001) movedAt.current = state.clock.elapsedTime;
    const next =
      id === controller.localSessionId && controller.localAnimation
        ? controller.localAnimation
        : state.clock.elapsedTime - movedAt.current < 0.18
          ? "walk"
          : "idle";
    if (next !== animation) setAnimation(next);
    last.current = { x: player.x, y: player.y };
    root.current.position.x += (point[0] - root.current.position.x) * Math.min(1, delta * 16);
    root.current.position.z += (point[2] - root.current.position.z) * Math.min(1, delta * 16);
    root.current.rotation.y =
      player.facing === "north"
        ? Math.PI
        : player.facing === "east"
          ? Math.PI / 2
          : player.facing === "west"
            ? -Math.PI / 2
            : 0;
  });
  const player = controller.players.get(id);
  if (!player) return null;
  return (
    <group
      ref={root}
      onClick={(event) => {
        event.stopPropagation();
        const player = controller.players.get(id);
        if (player && id !== controller.localSessionId) controller.selectPlayer(player);
      }}
    >
      <Character
        modelPath={DEVELOPMENT_MODELS.character}
        currentAnimation={animation}
        appearance={characterAppearance3D(
          id === controller.localSessionId
            ? controller.bridge.appearance
            : parseSavedAppearance(player.appearance),
          player.gender,
        )}
        scale={0.65}
      />
    </group>
  );
}
const trees: Vector3Tuple[] = [
  [-7, 0.6, -5],
  [-7, 0.6, 5],
  [7, 0.6, -5],
  [7, 0.6, 5],
];
function FollowCamera({ controller }: { controller: ThreeNeighborhoodController }) {
  const { camera, controls } = useThree();
  useFrame(() => {
    const orbit = controls as OrbitControls | undefined;
    if (!orbit) return;
    const point = sceneTo3D(toScene(controller.point, controller.bridge.origin));
    const dx = point[0] - orbit.target.x;
    const dz = point[2] - orbit.target.z;
    camera.position.x += dx;
    camera.position.z += dz;
    orbit.target.x = point[0];
    orbit.target.z = point[2];
    orbit.update();
  });
  return null;
}
function World({ controller }: { controller: ThreeNeighborhoodController }) {
  useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  useEffect(() => {
    controller.ready = true;
    return () => {
      controller.ready = false;
    };
  }, [controller]);
  const locations: CityLocationModel[] = (controller.bridge.area?.objects ?? [])
    .filter((object) => object.kind !== "npc")
    .map((object) => ({
      id: object.id,
      name: object.name,
      kind: object.kind === "npc" ? "landmark" : object.kind,
      position: sceneTo3D({ x: object.x, y: object.y - 33 }),
    }));
  return (
    <>
      <FollowCamera controller={controller} />
      <CityMap
        modelPaths={[DEVELOPMENT_MODELS.city]}
        locations={locations}
        onLocationSelect={(id) => controller.selectLocation(id)}
      />
      <RepeatedProps positions={trees} />
      {(controller.bridge.area?.objects ?? [])
        .filter((object) => object.kind === "npc")
        .map((object) => (
          <group
            key={object.id}
            position={sceneTo3D(object)}
            onClick={(event) => {
              event.stopPropagation();
              controller.selectLocation(object.id);
            }}
          >
            <Character
              modelPath={DEVELOPMENT_MODELS.character}
              currentAnimation="Idle"
              appearance={characterAppearance3D(
                controller.bridge.appearance,
                controller.bridge.gender,
              )}
              scale={0.65}
            />
            <Html
              position={[0, 1.3, 0]}
              center
              style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
            >
              {object.name}
            </Html>
          </group>
        ))}
      {locations.map((location) => (
        <Html
          key={location.id}
          position={[location.position[0], 2.2, location.position[2]]}
          center
          style={{
            pointerEvents: "none",
            whiteSpace: "nowrap",
            fontSize: 12,
            background: "white",
            borderRadius: 8,
            padding: 4,
          }}
        >
          {location.name}
        </Html>
      ))}
      {Array.from(controller.players.keys(), (id) => (
        <NetworkActor key={id} id={id} controller={controller} />
      ))}
    </>
  );
}

export function createNeighborhoodGame(
  host: HTMLElement,
  bridge: NeighborhoodBridge & { onSceneError?: (error: Error) => void },
) {
  const root = createRoot(host);
  const controller = new ThreeNeighborhoodController(bridge);
  const unbind = controller.bind();
  preloadModels([
    DEVELOPMENT_MODELS.character,
    DEVELOPMENT_MODELS.city,
    DEVELOPMENT_MODELS.building,
  ]);
  function Render() {
    useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
    return (
      <Scene
        animated
        zoom={controller.zoomValue}
        onError={(error) => {
          controller.lock(true);
          bridge.onSceneError?.(error);
        }}
      >
        <World controller={controller} />
      </Scene>
    );
  }
  root.render(<Render />);
  return {
    scene: controller,
    game: {
      destroy: (_removeCanvas?: boolean) => {
        unbind();
        root.unmount();
        controller.players.clear();
      },
    },
  };
}

// A controlled loader API, separate from authoritative exterior travel.
export function InteriorPreview({ modelPath = DEVELOPMENT_MODELS.room }: { modelPath?: string }) {
  return (
    <Scene animated>
      <Room modelPath={modelPath}>
        <Character modelPath={DEVELOPMENT_MODELS.character} />
      </Room>
    </Scene>
  );
}
