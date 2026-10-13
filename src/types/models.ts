export type Vector3Tuple = [number, number, number];
export type ModelPart = {
  modelPath: string;
  socket?: string;
  /** Stable wardrobe category for callers; the GLB socket and rig remain asset-defined. */
  slot?: "hair" | "outfit" | "accessory";
};
export type CharacterAnimationState = "idle" | "walk" | "sit" | "work" | "wave" | "talk";
export type CharacterAppearance3D = {
  skinTone?: string;
  hairColor?: string;
  hairStyle?: "short" | "afro" | "braids" | "locs" | "bald";
  outfitColor?: string;
  hairPart?: ModelPart;
  outfitPart?: ModelPart;
};
export type CharacterModel = {
  modelPath: string;
  parts?: readonly ModelPart[];
  appearance?: CharacterAppearance3D;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: number | Vector3Tuple;
  currentAnimation?: CharacterAnimationState | string;
  animationNames?: Readonly<Record<string, string>>;
};
export type CityLocationKind = "home" | "market" | "work" | "landmark";
export type CityLocationModel = {
  id: string;
  name: string;
  /** Explicit modelPath overrides the kind mapping for one-off landmarks or variants. */
  modelPath?: string;
  kind?: CityLocationKind;
  position: Vector3Tuple;
  scale?: number | Vector3Tuple;
  roomPath?: string;
};
export type SceneView = { kind: "city" } | { kind: "room"; locationId: string; modelPath: string };
export const DRACO_PATH = "/models/draco/";
export const DEVELOPMENT_MODELS = {
  character: "/models/characters/development-character.glb",
  city: "/models/city/development-city.glb",
  building: "/models/city/development-building.glb",
  room: "/models/rooms/development-room.glb",
} as const;

/** Replace each fallback with its reviewed Blender export as the matching assets are ready. */
export const CITY_LOCATION_MODEL_PATHS: Readonly<Record<CityLocationKind, string>> = {
  home: DEVELOPMENT_MODELS.building,
  market: DEVELOPMENT_MODELS.building,
  work: DEVELOPMENT_MODELS.building,
  landmark: DEVELOPMENT_MODELS.building,
};

export function cityLocationModelPath(location: Pick<CityLocationModel, "kind" | "modelPath">) {
  return location.modelPath ?? CITY_LOCATION_MODEL_PATHS[location.kind ?? "landmark"];
}
