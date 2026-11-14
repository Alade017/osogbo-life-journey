import { useSyncExternalStore } from "react";
import type { WorldPoint } from "@/game/neighborhood-model";
import {
  HOME_MAP_ANCHOR,
  OLAIYA_ORIGIN,
  scenePointToNormalized2D,
  scenePointToThreeXZ,
} from "@/data/neighborhoodLocations";
import { toScene } from "@/game/neighborhood-model";

export interface LivePlayerPose {
  worldX: number;
  worldY: number;
  sceneX: number;
  sceneY: number;
  threeX: number;
  threeZ: number;
  locationSlug: string;
  updatedAt: number;
}

export interface PendingNeighborhoodNav {
  id: string;
  mode: "walk" | "keke";
  landmarkId: string;
  landmarkName: string;
  primaryZoneId: string;
  targetScenePoint: WorldPoint;
  dropOffScenePoint: WorldPoint;
  fare: number;
  issuedAt: number;
}

const POSE_STORAGE_KEY = "osun:neighborhood:live-pose";
const NAV_STORAGE_KEY = "osun:neighborhood:pending-nav";
const PERSISTED_SLICE_KEY = "osun:neighborhood:slice-offsets";

const listeners = new Set<() => void>();
let cachedPose: LivePlayerPose | null = null;
let cachedNav: PendingNeighborhoodNav | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function safeReadStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteStorage<T>(key: string, value: T | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Ignore storage quota or private-mode restrictions; in-memory state still works.
  }
}

export function publishLivePlayerPose(pose: LivePlayerPose): void {
  if (
    cachedPose &&
    cachedPose.locationSlug === pose.locationSlug &&
    Math.abs(cachedPose.sceneX - pose.sceneX) < 0.5 &&
    Math.abs(cachedPose.sceneY - pose.sceneY) < 0.5
  ) {
    return;
  }
  cachedPose = pose;
  safeWriteStorage(POSE_STORAGE_KEY, pose);
  notify();
}

export function readLivePlayerPose(): LivePlayerPose | null {
  if (cachedPose) return cachedPose;
  const stored = safeReadStorage<LivePlayerPose>(POSE_STORAGE_KEY);
  if (stored && Number.isFinite(stored.sceneX) && Number.isFinite(stored.sceneY)) {
    cachedPose = stored;
    return stored;
  }
  return null;
}

export function useLivePlayerPose(): LivePlayerPose | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => readLivePlayerPose(),
    () => null,
  );
}

export function resolvePlayerMapPosition(
  character?: {
    world_x?: number | null;
    world_y?: number | null;
  } | null,
  livePose?: LivePlayerPose | null,
): {
  scenePoint: WorldPoint;
  world3D: readonly [number, number];
  mapCoords: Readonly<{ x: number; y: number }>;
  isLive: boolean;
} {
  if (livePose) {
    return {
      scenePoint: { x: livePose.sceneX, y: livePose.sceneY },
      world3D: [livePose.threeX, livePose.threeZ],
      mapCoords: scenePointToNormalized2D({ x: livePose.sceneX, y: livePose.sceneY }),
      isLive: true,
    };
  }
  if (
    character &&
    typeof character.world_x === "number" &&
    typeof character.world_y === "number" &&
    Number.isFinite(character.world_x) &&
    Number.isFinite(character.world_y)
  ) {
    const scene = toScene({ x: character.world_x, y: character.world_y }, OLAIYA_ORIGIN);
    return {
      scenePoint: scene,
      world3D: scenePointToThreeXZ(scene),
      mapCoords: scenePointToNormalized2D(scene),
      isLive: false,
    };
  }
  return {
    scenePoint: HOME_MAP_ANCHOR.scenePoint,
    world3D: HOME_MAP_ANCHOR.world3D,
    mapCoords: HOME_MAP_ANCHOR.mapCoords,
    isLive: false,
  };
}

export function enqueueNeighborhoodNavigation(
  command: Omit<PendingNeighborhoodNav, "id" | "issuedAt">,
): PendingNeighborhoodNav {
  const full: PendingNeighborhoodNav = {
    ...command,
    id: `nav-${command.mode}-${command.landmarkId}-${Date.now()}`,
    issuedAt: Date.now(),
  };
  cachedNav = full;
  safeWriteStorage(NAV_STORAGE_KEY, full);
  notify();
  return full;
}

export function peekNeighborhoodNavigation(): PendingNeighborhoodNav | null {
  if (cachedNav) return cachedNav;
  const stored = safeReadStorage<PendingNeighborhoodNav>(NAV_STORAGE_KEY);
  if (stored && Date.now() - stored.issuedAt < 5 * 60_000) {
    cachedNav = stored;
    return stored;
  }
  return null;
}

export function consumeNeighborhoodNavigation(): PendingNeighborhoodNav | null {
  const current = peekNeighborhoodNavigation();
  cachedNav = null;
  safeWriteStorage(NAV_STORAGE_KEY, null);
  notify();
  return current;
}

export function clearNeighborhoodNavigation(): void {
  cachedNav = null;
  safeWriteStorage(NAV_STORAGE_KEY, null);
  notify();
}

export function readPersistedSliceSnapshot<T>(): T | null {
  return safeReadStorage<T>(PERSISTED_SLICE_KEY);
}

export function writePersistedSliceSnapshot<T>(snapshot: T): void {
  safeWriteStorage(PERSISTED_SLICE_KEY, snapshot);
}

export function resetNeighborhoodNavSyncForTests(): void {
  cachedPose = null;
  cachedNav = null;
  safeWriteStorage(POSE_STORAGE_KEY, null);
  safeWriteStorage(NAV_STORAGE_KEY, null);
  safeWriteStorage(PERSISTED_SLICE_KEY, null);
}
