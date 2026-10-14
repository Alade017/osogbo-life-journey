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
export const DRACO_PATH = "/models/draco/";
export const DEVELOPMENT_MODELS = {
  character: "/models/characters/development-character.glb",
  room: "/models/rooms/development-room.glb",
} as const;
